import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get('category');
    const dateStr = searchParams.get('date');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(5, parseInt(searchParams.get('limit') || '25', 10)));
    const skip = (page - 1) * limit;

    const whereClause = {};

    if (categorySlug && categorySlug !== 'all') {
      whereClause.category = { slug: categorySlug };
    }

    if (dateStr) {
      whereClause.dateStr = dateStr;
    }

    const results = await prisma.teerResult.findMany({
      where: whereClause,
      orderBy: { dateStr: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        dateStr: true,
        round1: true,
        round2: true,
        status: true,
        isVerified: true,
        sourceInfo: true,
        category: {
          select: {
            name: true,
            slug: true,
            location: true,
            round1Time: true,
            round2Time: true,
          },
        },
      },
    });

    let totalCount = results.length;
    try {
      totalCount = await prisma.teerResult.count({ where: whereClause });
    } catch {
      totalCount = results.length;
    }

    const formatted = results.map((r) => ({
      id: r.id,
      dateStr: r.dateStr,
      round1: r.round1 || '--',
      round2: r.round2 || '--',
      status: r.status,
      isVerified: r.isVerified,
      sourceInfo: r.sourceInfo,
      category: r.category,
    }));

    return NextResponse.json(
      {
        success: true,
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        results: formatted,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
          'CDN-Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching history results:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch historical results' },
      { status: 500 }
    );
  }
}
