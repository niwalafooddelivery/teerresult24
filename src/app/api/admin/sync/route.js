import { NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { runSyncJob } from '@/lib/importers/sync-engine';
import prisma from '@/lib/prisma';

export async function POST(request) {
  try {
    const tokenCookie = request.cookies.get('teer_admin_token')?.value;
    const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = tokenCookie || authHeader;

    const user = token ? verifyToken(token) : null;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin session required' },
        { status: 401 }
      );
    }

    const syncResult = await runSyncJob({
      requestedBy: `Admin Manual (${user.name || user.username})`,
    });

    return NextResponse.json(syncResult);
  } catch (err) {
    console.error('Admin sync error:', err);
    return NextResponse.json(
      { success: false, error: `Sync failed: ${err.message}` },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const tokenCookie = request.cookies.get('teer_admin_token')?.value;
    const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
    const token = tokenCookie || authHeader;

    const user = token ? verifyToken(token) : null;
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let recentJobs = [];
    let recentSourceRecords = [];
    try {
      recentJobs = await prisma.importJob.findMany({
        take: 10,
        orderBy: { startedAt: 'desc' },
      });
      recentSourceRecords = await prisma.sourceRecord.findMany({
        take: 5,
        orderBy: { fetchedAt: 'desc' },
      });
    } catch (dbErr) {
      console.warn('[api/admin/sync] Database query failed for jobs/records:', dbErr.message || dbErr);
    }

    return NextResponse.json({
      success: true,
      recentJobs,
      recentSourceRecords,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
