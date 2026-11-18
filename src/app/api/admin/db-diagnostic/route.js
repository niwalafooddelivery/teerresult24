import { NextResponse } from 'next/server';
import prisma, { getResolvedDatabaseConfig, sanitizeDatabaseUrl } from '@/lib/prisma';
import { ensureDatabaseBootstrap } from '@/lib/db-bootstrap';
import { ensureOfficialCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    config: {},
    connectionOk: false,
    tablesFound: [],
    categories: [],
    error: null,
  };

  try {
    const dbConfig = getResolvedDatabaseConfig();
    diagnostics.config = {
      source: dbConfig.source,
      isHyperdrive: dbConfig.isHyperdrive,
      url: sanitizeDatabaseUrl(dbConfig.url),
    };

    // 1. Test basic connection
    try {
      await prisma.$executeRawUnsafe('SELECT 1');
      diagnostics.connectionOk = true;
    } catch (connErr) {
      diagnostics.connectionOk = false;
      diagnostics.error = `Connection error: ${connErr.message}`;
      return NextResponse.json(diagnostics, { status: 500 });
    }

    // 2. Run self-healing bootstrap to guarantee tables exist
    await ensureDatabaseBootstrap(prisma);

    // 3. Ensure official categories exist
    await ensureOfficialCategories(prisma);

    // 4. Query categories
    const categories = await prisma.gameCategory.findMany({
      orderBy: { order: 'asc' },
    });

    diagnostics.categories = categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      round1Time: c.round1Time,
      round2Time: c.round2Time,
      isActive: c.isActive,
    }));

    return NextResponse.json({
      success: true,
      ...diagnostics,
    });
  } catch (err) {
    diagnostics.error = err.message || String(err);
    return NextResponse.json({
      success: false,
      ...diagnostics,
    }, { status: 500 });
  }
}
