import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getOfficialCategories, OFFICIAL_CATEGORIES } from '@/lib/categories';
import { ensureDatabaseBootstrap } from '@/lib/db-bootstrap';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    let categories = [];
    try {
      categories = await getOfficialCategories(prisma);
    } catch (queryErr) {
      console.warn('[api/admin/categories] Primary query failed:', queryErr.message || queryErr);
    }

    if (!categories || categories.length === 0) {
      try {
        await ensureDatabaseBootstrap(prisma);
        categories = await getOfficialCategories(prisma);
      } catch (bootErr) {
        console.warn('[api/admin/categories] Bootstrap fallback failed:', bootErr.message || bootErr);
      }
    }

    const finalCategories = (categories && categories.length > 0) ? categories : OFFICIAL_CATEGORIES;

    return NextResponse.json({
      success: true,
      categories: finalCategories.map((c) => ({
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
    console.warn('[api/admin/categories] Fallback to canonical categories:', error.message || error);
    return NextResponse.json({
      success: true,
      categories: OFFICIAL_CATEGORIES.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        location: c.location,
        round1Time: c.round1Time,
        round2Time: c.round2Time,
        order: c.order,
      })),
    });
  }
}
