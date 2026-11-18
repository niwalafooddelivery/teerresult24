import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOfficialCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const categories = await getOfficialCategories(prisma);

    return NextResponse.json({
      success: true,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        location: c.location,
        round1Time: c.round1Time,
        round2Time: c.round2Time,
        order: c.order,
      })),
    });
  } catch (error) {
    console.error('Error in /api/admin/categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
