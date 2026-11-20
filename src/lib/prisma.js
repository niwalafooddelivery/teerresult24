import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { getCloudflareContext } from '@opennextjs/cloudflare';

// Mask user and password in database URLs for safe logging
export function sanitizeDatabaseUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '[EMPTY]';
  try {
    const parsed = new URL(rawUrl);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = parsed.username.slice(0, 3) + '***';
    return parsed.toString();
  } catch {
    return '[INVALID_URL]';
  }
}

const globalForPrisma = globalThis;

/**
 * Resolves database connection string at request runtime:
 * 1. Cloudflare Hyperdrive binding: env.HYPERDRIVE.connectionString
 * 2. Cloudflare environment secret: env.DATABASE_URL
 * 3. Node environment: process.env.DATABASE_URL
 */
export function getResolvedDatabaseConfig() {
  let cf = null;
  // 1. Try Cloudflare Context (Workers runtime request scope)
  try {
    cf = getCloudflareContext();
  } catch (_ctxErr) {
    // getCloudflareContext throws outside request context (build time, CLI, local scripts)
  }

  if (cf?.env?.HYPERDRIVE?.connectionString) {
    return {
      url: cf.env.HYPERDRIVE.connectionString,
      source: 'Cloudflare Hyperdrive (HYPERDRIVE binding)',
      isHyperdrive: true,
      cf,
    };
  }

  if (cf?.env?.DATABASE_URL) {
    return {
      url: cf.env.DATABASE_URL,
      source: 'Cloudflare Environment Secret (DATABASE_URL)',
      isHyperdrive: false,
      cf,
    };
  }

  // 2. Process environment fallback (Node CLI, local dev, migrations, tests)
  const envUrl = process.env.DATABASE_URL || '';
  if (envUrl) {
    return {
      url: envUrl,
      source: 'Process Environment (process.env.DATABASE_URL)',
      isHyperdrive: false,
      cf: null,
    };
  }

  return { url: '', source: 'None', isHyperdrive: false, cf: null };
}

/**
 * Lazily creates or reuses the PrismaClient instance with @prisma/adapter-pg.
 * - In Cloudflare Workers: Scoped to the request (cf) so dead TCP sockets never linger across requests.
 * - In Node CLI / Tests: Scoped to globalThis singleton.
 */
export function getPrismaClient() {
  const { url, source, isHyperdrive, cf } = getResolvedDatabaseConfig();

  // Mode A: Cloudflare Workers Request Scope
  // Sockets are scoped to the individual request (cf) so frozen isolates never reuse dead sockets
  if (cf) {
    if (cf.__prismaClient) {
      return cf.__prismaClient;
    }

    if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
      try {
        const pool = new Pool({
          connectionString: url,
          max: 2, // Hyperdrive already maintains an upstream pool
          connectionTimeoutMillis: 5000,
          idleTimeoutMillis: 1000,
        });

        pool.on('error', (err) => {
          console.warn('[Workers Hyperdrive Pool Warning]:', err.message || err);
        });

        const adapter = new PrismaPg(pool);
        const client = new PrismaClient({
          adapter,
          log: ['error'],
        });

        cf.__prismaClient = client;
        cf.__pgPool = pool;
        return client;
      } catch (err) {
        console.error(`[PrismaClient] Workers initialization failed via ${source}:`, err.message || err);
        throw err;
      }
    }
  }

  // Mode B: Local Node Environment / Unit Tests / CLI (Global singleton)
  if (globalForPrisma.__prismaClient && globalForPrisma.__prismaUrl === url) {
    return globalForPrisma.__prismaClient;
  }

  // 1. PostgreSQL (Node.js runtime)
  if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
    try {
      if (globalForPrisma.__pgPool) {
        try { globalForPrisma.__pgPool.end(); } catch {}
        globalForPrisma.__pgPool = null;
      }

      const pool = new Pool({
        connectionString: url,
        max: isHyperdrive ? 5 : 10,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
      });

      pool.on('error', (err) => {
        console.warn('[Node Database Pool Warning]:', err.message || err);
      });

      const adapter = new PrismaPg(pool);
      const client = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });

      globalForPrisma.__prismaClient = client;
      globalForPrisma.__prismaUrl = url;
      globalForPrisma.__pgPool = pool;

      return client;
    } catch (err) {
      console.error(`[PrismaClient] Node initialization failed via ${source} (${sanitizeDatabaseUrl(url)}):`, err.message || err);
      throw err;
    }
  }

  // 2. SQLite (Local unit tests / disposable DB)
  if (url && url.startsWith('file:')) {
    const client = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
    globalForPrisma.__prismaClient = client;
    globalForPrisma.__prismaUrl = url;
    return client;
  }

  // 3. Fallback when no database URL is available
  throw new Error(
    `[PrismaClient] No database connection configured. Please ensure Cloudflare Hyperdrive binding (HYPERDRIVE) or DATABASE_URL secret is set in Cloudflare Dashboard.`
  );
}

/**
 * Dynamic Proxy export:
 * Allows transparent `import prisma from '@/lib/prisma'` across all routes.
 * Resolves the client on-demand upon first query inside request scope.
 */
export const prisma = new Proxy({}, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

export default prisma;
