import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis;

function createPrismaClient() {
  const url = process.env.DATABASE_URL || '';

  // If running with PostgreSQL (Production / Cloudflare Workers)
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    try {
      const pool = new Pool({
        connectionString: url,
        max: 10,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
      });
      const adapter = new PrismaPg(pool);
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      });
    } catch (err) {
      console.warn('[PrismaClient] Failed to initialize PrismaPg adapter, falling back:', err.message || err);
    }
  }

  // Standard PrismaClient (e.g., Prisma Accelerate or direct connection)
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
