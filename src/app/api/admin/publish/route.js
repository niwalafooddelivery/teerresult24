import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { validateTeerNumber, getTodayISTDateStr } from '@/lib/date-utils';

/**
 * Validates that an evidence URL is a syntactically valid HTTP/HTTPS URL.
 * Does not allow arbitrary text strings to qualify as source evidence.
 */
function isValidEvidenceUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

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
    const {
      categoryId,
      dateStr,
      round1,
      round2,
      status,
      sourceInfo,
      sourceEvidenceUrl,
      notes,
      correctionReason,
      action = 'submit', // 'submit' (default: pending verification) or 'approve_and_verify'
    } = body;

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'Category ID is required' },
        { status: 400 }
      );
    }

    // Strict format validation for 2-digit numbers
    const v1 = validateTeerNumber(round1);
    const v2 = validateTeerNumber(round2);

    if (!v1.isValid) {
      return NextResponse.json({ success: false, error: `Round 1: ${v1.error}` }, { status: 400 });
    }
    if (!v2.isValid) {
      return NextResponse.json({ success: false, error: `Round 2: ${v2.error}` }, { status: 400 });
    }

    const targetDate = dateStr || getTodayISTDateStr();

    // Check verification approval requirements
    const isApprovalRequested = action === 'approve_and_verify';
    let validatedEvidenceUrl = null;

    if (isApprovalRequested) {
      const cleanUrl = (sourceEvidenceUrl || '').trim();
      if (!isValidEvidenceUrl(cleanUrl)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Official verification requires a valid source evidence URL (must begin with http:// or https://, e.g. https://example.com/official-bulletin).',
          },
          { status: 400 }
        );
      }
      validatedEvidenceUrl = cleanUrl;
    }

    // Atomic database transaction to prevent concurrent publish or overwrite race conditions
    const result = await prisma.$transaction(async (tx) => {
      // Check existing record within isolation boundary
      const existing = await tx.teerResult.findUnique({
        where: {
          categoryId_dateStr: {
            categoryId,
            dateStr: targetDate,
          },
        },
      });

      if (existing) {
        const round1Changed = existing.round1 !== v1.value;
        const round2Changed = existing.round2 !== v2.value;
        const scoreChanged = round1Changed || round2Changed;

        // Log official revisions/corrections into audit table
        if (round1Changed && existing.round1 !== null) {
          await tx.correctionLog.create({
            data: {
              resultId: existing.id,
              roundNumber: 1,
              oldValue: existing.round1,
              newValue: v1.value || '--',
              reason: correctionReason || 'Editorial score revision after field verification',
              correctedBy: user.name || user.username,
            },
          });
        }

        if (round2Changed && existing.round2 !== null) {
          await tx.correctionLog.create({
            data: {
              resultId: existing.id,
              roundNumber: 2,
              oldValue: existing.round2,
              newValue: v2.value || '--',
              reason: correctionReason || 'Editorial score revision after field verification',
              correctedBy: user.name || user.username,
            },
          });
        }

        // Determine verification state:
        // If a score changed, any previous verification is REVOKED unless fresh authenticated approval is provided.
        let nextIsVerified = false;
        let nextVerifiedAt = null;
        let nextVerifiedBy = null;
        let nextEvidenceUrl = null;

        if (scoreChanged) {
          if (isApprovalRequested) {
            nextIsVerified = true;
            nextVerifiedAt = new Date();
            nextVerifiedBy = user.name || user.username;
            nextEvidenceUrl = validatedEvidenceUrl;
          } else {
            // Explicitly clear verification metadata when revised without renewed approval
            nextIsVerified = false;
            nextVerifiedAt = null;
            nextVerifiedBy = null;
            nextEvidenceUrl = null;
          }
        } else {
          // Scores did not change: allow explicit approval or retain existing verification
          if (isApprovalRequested) {
            nextIsVerified = true;
            nextVerifiedAt = new Date();
            nextVerifiedBy = user.name || user.username;
            nextEvidenceUrl = validatedEvidenceUrl;
          } else {
            nextIsVerified = existing.isVerified;
            nextVerifiedAt = existing.verifiedAt;
            nextVerifiedBy = existing.verifiedBy;
            nextEvidenceUrl = existing.sourceEvidenceUrl;
          }
        }

        // Calculate final status
        let finalStatus = status;
        if (!finalStatus) {
          if (scoreChanged && (existing.round1 !== null || existing.round2 !== null) && !nextIsVerified) {
            finalStatus = 'CORRECTED';
          } else if (v1.value && v2.value) {
            finalStatus = 'COMPLETED';
          } else if (v1.value || v2.value) {
            finalStatus = 'PARTIAL';
          } else {
            finalStatus = 'PENDING';
          }
        }

        const updated = await tx.teerResult.update({
          where: { id: existing.id },
          data: {
            round1: v1.value,
            round2: v2.value,
            status: finalStatus,
            isVerified: nextIsVerified,
            verifiedAt: nextVerifiedAt,
            verifiedBy: nextVerifiedBy,
            sourceInfo: sourceInfo || (nextIsVerified ? 'Officially Corroborated' : 'Pending Verification'),
            sourceEvidenceUrl: nextEvidenceUrl,
            notes: notes !== undefined ? notes : existing.notes,
            round1PublishedAt: v1.value ? (existing.round1PublishedAt || new Date()) : existing.round1PublishedAt,
            round2PublishedAt: v2.value ? (existing.round2PublishedAt || new Date()) : existing.round2PublishedAt,
          },
        });

        let responseMsg = 'Result recorded as pending verification.';
        if (nextIsVerified) {
          responseMsg = 'Result officially verified with documented provenance.';
        } else if (scoreChanged && existing.isVerified) {
          responseMsg = 'Score was updated: previous verification revoked until fresh approval with valid evidence is submitted.';
        }

        return {
          responseMsg,
          result: updated,
        };
      }

      // Determine initial status for new record
      let newStatus = status;
      if (!newStatus) {
        if (v1.value && v2.value) {
          newStatus = 'COMPLETED';
        } else if (v1.value || v2.value) {
          newStatus = 'PARTIAL';
        } else {
          newStatus = 'PENDING';
        }
      }

      // Create new record (Pending verification by default unless approved with valid URL)
      const created = await tx.teerResult.create({
        data: {
          categoryId,
          dateStr: targetDate,
          round1: v1.value,
          round2: v2.value,
          status: newStatus,
          isVerified: isApprovalRequested,
          verifiedAt: isApprovalRequested ? new Date() : null,
          verifiedBy: isApprovalRequested ? (user.name || user.username) : null,
          sourceInfo: sourceInfo || (isApprovalRequested ? 'Officially Corroborated' : 'Pending Verification'),
          sourceEvidenceUrl: validatedEvidenceUrl,
          notes,
          round1PublishedAt: v1.value ? new Date() : null,
          round2PublishedAt: v2.value ? new Date() : null,
        },
      });

      return {
        responseMsg: isApprovalRequested
          ? 'Result officially verified with documented provenance.'
          : 'Result recorded as pending verification.',
        result: created,
      };
    });

    return NextResponse.json({
      success: true,
      message: result.responseMsg,
      result: result.result,
    });
  } catch (error) {
    console.error('Error publishing result:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record result' },
      { status: 500 }
    );
  }
}
