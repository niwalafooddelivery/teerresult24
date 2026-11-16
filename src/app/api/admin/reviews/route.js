import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import {
  processReviewApproval,
  processReviewRejection,
} from '@/lib/review-manager';

/**
 * Admin Pending Review Queue API
 * GET: Lists pending reviews
 * POST: Approves or Rejects a pending review
 */

function getAdminUser(request) {
  const tokenCookie = request.cookies.get('teer_admin_token')?.value;
  const authHeader = request.headers.get('authorization')?.replace('Bearer ', '');
  const token = tokenCookie || authHeader;
  return token ? verifyToken(token) : null;
}

export async function GET(request) {
  try {
    const user = getAdminUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin session required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'PENDING';

    const reviews = await prisma.pendingResultReview.findMany({
      where: status === 'ALL' ? {} : { status },
      include: {
        category: {
          select: { name: true, slug: true, round1Time: true, round2Time: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const pendingCount = await prisma.pendingResultReview.count({
      where: { status: 'PENDING' },
    });

    return NextResponse.json({
      success: true,
      pendingCount,
      reviews,
    });
  } catch (error) {
    console.error('Fetch reviews error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const user = getAdminUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin session required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { reviewId, action, rejectionReason } = body;

    if (!reviewId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Valid reviewId and action ("approve" or "reject") required' },
        { status: 400 }
      );
    }

    // Step 1: Reject Action
    if (action === 'reject') {
      const updatedReview = await processReviewRejection({
        reviewId,
        user,
        rejectionReason,
        prismaClient: prisma,
      });

      return NextResponse.json({
        success: true,
        message: 'Pending review rejected safely. Public scores remain untouched.',
        review: updatedReview,
      });
    }

    // Step 2: Approve Action (Verified or Unverified)
    const result = await processReviewApproval({
      reviewId,
      user,
      options: body,
      prismaClient: prisma,
    });

    return NextResponse.json({
      success: true,
      message: result.updatedResult.isVerified
        ? `Review approved and officially verified for ${result.approvedReview.category?.name || 'game'} (${result.approvedReview.dateStr}) with status ${result.updatedResult.status}.`
        : `Review approved and published as unverified live score for ${result.approvedReview.category?.name || 'game'} (${result.approvedReview.dateStr}) with status ${result.updatedResult.status}.`,
      result: result.updatedResult,
      review: result.approvedReview,
    });
  } catch (error) {
    if (error.message === 'CONCURRENT_REVIEW_CONFLICT') {
      return NextResponse.json(
        {
          success: false,
          error: 'Conflict: This review item has already been approved or processed by another session.',
        },
        { status: 409 }
      );
    }
    if (error.statusCode === 400 || error.message.startsWith('CORRECTION_REASON_REQUIRED')) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 400 }
      );
    }
    console.error('Review action error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Action failed' },
      { status: error.statusCode || 500 }
    );
  }
}
