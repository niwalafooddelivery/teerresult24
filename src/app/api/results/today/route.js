import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getTodayISTDateStr } from '@/lib/date-utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const todayStr = getTodayISTDateStr();

    const categories = await prisma.gameCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        results: {
          where: { dateStr: todayStr },
          take: 1,
        },
      },
    });

    const liveData = categories.map((cat) => {
      const result = cat.results[0] || null;
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
