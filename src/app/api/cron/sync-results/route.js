import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { runSyncJob } from '@/lib/importers/sync-engine';

export const dynamic = 'force-dynamic';

/**
 * Validates cron authorization strictly using Bearer token authentication.
 * URL query parameter tokens (?token=...) are explicitly rejected for security.
 */
function isBearerAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;

  // Strict Bearer check
  return authHeader.trim() === `Bearer ${cronSecret.trim()}`;
}

export async function GET(request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json(
        { success: false, error: 'CRON_SECRET is not configured on the server' },
        { status: 500 }
      );
    }

    // Require strict Bearer token
    if (!isBearerAuthorized(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Missing or invalid Bearer authentication token' },
        { status: 401 }
      );
    }

    // Execute synchronization (all executions obey database lock)
    const syncResult = await runSyncJob({
      requestedBy: 'Vercel Cron Automation',
    });

    const statusCode = syncResult.success || syncResult.skipped ? 200 : 500;
    return NextResponse.json(syncResult, { status: statusCode });
  } catch (err) {
    console.error('Cron execution error:', err);
    return NextResponse.json(
      { success: false, error: `Cron execution failure: ${err.message}` },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  return GET(request);
}
