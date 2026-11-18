import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTodayISTDateStr } from '@/lib/date-utils';
import { ensureOfficialCategories, OFFICIAL_CATEGORIES } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const todayStr = getTodayISTDateStr();

    let categories = [];
    try {
      categories = await prisma.gameCategory.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: {
          results: {
            where: { dateStr: todayStr },
            take: 1,
          },
        },
      });

      // If database is initialized but unseeded, auto-seed the 4 official categories
      if (!categories || categories.length === 0) {
        await ensureOfficialCategories(prisma);
        categories = await prisma.gameCategory.findMany({
          where: { isActive: true },
          orderBy: { order: 'asc' },
          include: {
            results: {
              where: { dateStr: todayStr },
              take: 1,
            },
          },
        });
      }
    } catch (dbErr) {
      console.warn('[api/results/today] Database query failed, using canonical fallback:', dbErr.message || dbErr);
    }

    // Graceful fallback if database has no categories or is unmigrated
    if (!categories || categories.length === 0) {
      const fallbackData = OFFICIAL_CATEGORIES.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        location: cat.location,
        round1Time: cat.round1Time,
        round2Time: cat.round2Time,
        round1: null,
        round2: null,
        status: 'PENDING',
        isVerified: false,
        sourceInfo: 'Official Field Record',
        sourceEvidenceUrl: null,
        updatedAt: new Date().toISOString(),
      }));

      return NextResponse.json({
        success: true,
        date: todayStr,
        results: fallbackData,
      });
    }

    const liveData = categories.map((cat) => {
      const result = cat.results?.[0] || null;
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        location: cat.location,
        round1Time: cat.round1Time,
        round2Time: cat.round2Time,
        round1: result?.round1 || null,
        round2: result?.round2 || null,
        status: result?.status || 'PENDING',
        isVerified: result?.isVerified ?? false,
        sourceInfo: result?.sourceInfo || 'Official Field Record',
        sourceEvidenceUrl: result?.sourceEvidenceUrl || null,
        updatedAt: result?.updatedAt || cat.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      date: todayStr,
      results: liveData,
    });
  } catch (error) {
    console.error('Error fetching today results:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch live results' },
      { status: 500 }
    );
  }
}
