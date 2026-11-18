import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { recordAdminResult } from '@/lib/publish-manager';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const tokenCookie = request.cookies.get('teer_admin_token')?.value;
    const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = tokenCookie || authHeader;

    const user = token ? verifyToken(token) : null;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized access. Please login with admin credentials.' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const publishOutcome = await recordAdminResult({
      ...body,
      user,
    }, prisma);

    return NextResponse.json(publishOutcome);
  } catch (error) {
    console.error('Error publishing result:', error);
    let userFriendlyMessage = 'Failed to record result. Please verify database connectivity.';
    let statusCode = error?.statusCode || 500;

    if (error?.code === 'P2003') {
      userFriendlyMessage = `Database foreign key constraint error: Category ID could not be linked.`;
      statusCode = 400;
    } else if (error?.code === 'P2002') {
      userFriendlyMessage = `Conflict: A result for this competition category and date already exists.`;
      statusCode = 409;
    } else if (error?.code === 'P2021' || (error?.message && error.message.includes('does not exist'))) {
      userFriendlyMessage = `Database schema error: Required database table does not exist. Please apply the safe database migration.`;
      statusCode = 500;
    } else if (error?.message) {
      const sanitized = error.message.split('\n')[0].replace(/postgres:\/\/[^@]+@/g, 'postgres://***@');
      userFriendlyMessage = sanitized;
    }

    return NextResponse.json(
      { success: false, error: userFriendlyMessage },
      { status: statusCode }
    );
  }
}
