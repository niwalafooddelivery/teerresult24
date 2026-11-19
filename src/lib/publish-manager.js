/**
 * TeerResult2 — Admin Result Publishing & Provenance Service
 * Encapsulates validation, dynamic category resolution, atomic persistence,
 * revision auditing, and provenance verification.
 */

import prisma from './prisma.js';
import { validateTeerNumber, getTodayISTDateStr, isValidCalendarDate } from './date-utils.js';
import { ensureOfficialCategories, resolveCanonicalCategorySlug } from './categories.js';
import { ensureDatabaseBootstrap } from './db-bootstrap.js';

/**
 * Validates that an evidence URL is a syntactically valid HTTP/HTTPS URL.
 * Does not allow arbitrary text strings to qualify as source evidence.
 */
export function isValidEvidenceUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Records or updates a Teer result from the editorial admin dashboard.
 *
 * @param {Object} params
 * @param {string} params.categoryId - ID, slug, or name of the competition category
 * @param {string} [params.dateStr] - YYYY-MM-DD date in Asia/Kolkata
 * @param {string|null} [params.round1] - 2-digit number (e.g. "04") or null
 * @param {string|null} [params.round2] - 2-digit number (e.g. "09") or null
 * @param {string} [params.status] - Optional status override
 * @param {string} [params.sourceInfo] - Attribution source (e.g. "Polo Grounds Official Draw")
 * @param {string} [params.sourceEvidenceUrl] - Documented evidence URL (required for official verification)
 * @param {string} [params.notes] - Editorial notes
 * @param {string} [params.correctionReason] - Explanation if revising previously published numbers
 * @param {string} [params.action='submit'] - 'submit' (draft/pending verification) or 'approve_and_verify' (publish verified)
 * @param {Object} params.user - Authenticated admin user { id, username, name, role }
 * @param {Object} [params.db=prisma] - Prisma client instance
 */
export async function recordAdminResult(params, db = prisma) {
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
    action = 'submit',
    user,
  } = params || {};

  if (!user || (!user.username && !user.id)) {
    const err = new Error('Unauthorized access. Please login with admin credentials.');
    err.statusCode = 401;
    throw err;
  }

  if (!categoryId || typeof categoryId !== 'string' || !categoryId.trim()) {
    const err = new Error('Competition Category is required');
    err.statusCode = 400;
    throw err;
  }
  const cleanCatInput = categoryId.trim();

  // Strict format validation for 2-digit numbers preserving leading zeros ("00" - "99")
  const v1 = validateTeerNumber(round1);
  const v2 = validateTeerNumber(round2);

  if (!v1.isValid) {
    const err = new Error(`Round 1 (FR): ${v1.error}`);
    err.statusCode = 400;
    throw err;
  }
  if (!v2.isValid) {
    const err = new Error(`Round 2 (SR): ${v2.error}`);
    err.statusCode = 400;
    throw err;
  }

  // Date validation in Asia/Kolkata
  const targetDate = (dateStr && typeof dateStr === 'string' && dateStr.trim())
    ? dateStr.trim()
    : getTodayISTDateStr();

  if (!isValidCalendarDate(targetDate)) {
    const err = new Error(`Invalid result date format "${targetDate}". Expected YYYY-MM-DD.`);
    err.statusCode = 400;
    throw err;
  }

  // Dynamic Category Resolution:
  // Resolves category whether categoryId is a canonical slug, legacy identifier (e.g. cat_khanapara_teer), database CUID, or human name
  const canonicalSlug = resolveCanonicalCategorySlug(cleanCatInput);

  const CANONICAL_NAMES = {
    'shillong-teer': 'Shillong Teer',
    'khanapara-teer': 'Khanapara Teer',
    'juwai-teer': 'Juwai Teer',
    'shillong-night-teer': 'Shillong Night Teer',
  };
  const targetName = CANONICAL_NAMES[canonicalSlug] || cleanCatInput;

  const whereOr = [
    { slug: canonicalSlug },
    { name: targetName },
    { id: cleanCatInput },
    { id: canonicalSlug },
    { slug: cleanCatInput },
    { name: cleanCatInput },
  ];

  let category = null;

  try {
    category = await db.gameCategory.findFirst({
      where: { OR: whereOr },
    });
  } catch (initialErr) {
    console.error('[recordAdminResult] Database query error on GameCategory:', initialErr.message || initialErr);
    const sanitized = initialErr?.message ? initialErr.message.split('\n')[0].replace(/postgres:\/\/[^@]+@/g, 'postgres://***@') : String(initialErr);
    const err = new Error(`Database error resolving category "${cleanCatInput}": ${sanitized}`);
    err.statusCode = 500;
    throw err;
  }

  // If not found in database, run idempotent auto-seed
  if (!category) {
    try {
      await ensureDatabaseBootstrap(db);
      await ensureOfficialCategories(db);
      category = await db.gameCategory.findFirst({
        where: { OR: whereOr },
      });
    } catch (seedErr) {
      console.warn('[recordAdminResult] Self-healing bootstrap warning:', seedErr.message || seedErr);
    }
  }

  if (!category) {
    // Database is healthy, but the requested category was genuinely not found
    const allCats = await db.gameCategory.findMany({ select: { slug: true, name: true } }).catch(() => []);
    const available = allCats.map((c) => c.slug).join(', ') || 'none';
    const err = new Error(`Invalid competition category "${cleanCatInput}". Category could not be found in database. Available categories: [${available}].`);
    err.statusCode = 400;
    throw err;
  }

  const resolvedCategoryId = category.id;

  // Check existing public result record in TeerResult
  const existing = await db.teerResult.findUnique({
    where: {
      categoryId_dateStr: {
        categoryId: resolvedCategoryId,
        dateStr: targetDate,
      },
    },
  });

  const isApprovalRequested = action === 'approve_and_verify';
  let validatedEvidenceUrl = null;

  if (isApprovalRequested) {
    const cleanUrl = (sourceEvidenceUrl || '').trim();
    if (!isValidEvidenceUrl(cleanUrl)) {
      const err = new Error(
        'Official verification requires a valid source evidence URL (must begin with http:// or https://, e.g. https://example.com/official-bulletin).'
      );
      err.statusCode = 400;
      throw err;
    }
    validatedEvidenceUrl = cleanUrl;
  }

  const round1Changed = existing ? (existing.round1 !== v1.value) : false;
  const round2Changed = existing ? (existing.round2 !== v2.value) : false;
  const scoreChanged = round1Changed || round2Changed;

  // Revising an already verified official score requires explicit reason
  if (existing && existing.isVerified && scoreChanged && !correctionReason?.trim()) {
    const err = new Error('Revising a previously verified official score requires an explicit correction reason.');
    err.statusCode = 400;
    throw err;
  }

  // Log official score corrections into audit table safely
  if (existing && scoreChanged) {
    try {
      if (round1Changed && existing.round1 !== null) {
        await db.correctionLog.create({
          data: {
            resultId: existing.id,
            roundNumber: 1,
            oldValue: existing.round1,
            newValue: v1.value || '--',
            reason: correctionReason?.trim() || 'Editorial score revision after field verification',
            correctedBy: user.name || user.username || 'Admin',
          },
        });
      }

      if (round2Changed && existing.round2 !== null) {
        await db.correctionLog.create({
          data: {
            resultId: existing.id,
            roundNumber: 2,
            oldValue: existing.round2,
            newValue: v2.value || '--',
            reason: correctionReason?.trim() || 'Editorial score revision after field verification',
            correctedBy: user.name || user.username || 'Admin',
          },
        });
      }
    } catch (logErr) {
      console.warn('[recordAdminResult] Non-fatal: could not write to CorrectionLog audit table:', logErr.message || logErr);
    }
  }

  // Determine verification metadata
  const nextIsVerified = isApprovalRequested;
  const nextVerifiedAt = isApprovalRequested ? new Date() : null;
  const nextVerifiedBy = isApprovalRequested ? (user.name || user.username || 'Admin') : null;

  // Calculate final status
  let finalStatus = status;
  if (!finalStatus) {
    if (existing && scoreChanged && (existing.round1 !== null || existing.round2 !== null) && !nextIsVerified) {
      finalStatus = 'CORRECTED';
    } else if (v1.value && v2.value) {
      finalStatus = 'COMPLETED';
    } else if (v1.value || v2.value) {
      finalStatus = 'PARTIAL';
    } else {
      finalStatus = 'PENDING';
    }
  }

  // =========================================================================
  // Atomic persistence into TeerResult
  // If draft (action === 'submit'): stored with isVerified = false
  // If approved (action === 'approve_and_verify'): stored with isVerified = true, verifiedAt, verifiedBy
  // =========================================================================

  const savedResult = await db.teerResult.upsert({
    where: {
      categoryId_dateStr: {
        categoryId: resolvedCategoryId,
        dateStr: targetDate,
      },
    },
    update: {
      round1: v1.value,
      round2: v2.value,
      status: finalStatus,
      isVerified: nextIsVerified,
      verifiedAt: nextVerifiedAt,
      verifiedBy: nextVerifiedBy,
      sourceInfo: sourceInfo?.trim() || (nextIsVerified ? 'Officially Corroborated' : 'Pending Verification'),
      sourceEvidenceUrl: validatedEvidenceUrl,
      notes: notes !== undefined ? notes : (existing ? existing.notes : null),
      round1PublishedAt: v1.value ? (existing?.round1PublishedAt || new Date()) : (existing?.round1PublishedAt || null),
      round2PublishedAt: v2.value ? (existing?.round2PublishedAt || new Date()) : (existing?.round2PublishedAt || null),
    },
    create: {
      categoryId: resolvedCategoryId,
      dateStr: targetDate,
      round1: v1.value,
      round2: v2.value,
      status: finalStatus,
      isVerified: nextIsVerified,
      verifiedAt: nextVerifiedAt,
      verifiedBy: nextVerifiedBy,
      sourceInfo: sourceInfo?.trim() || (nextIsVerified ? 'Officially Corroborated' : 'Pending Verification'),
      sourceEvidenceUrl: validatedEvidenceUrl,
      notes: notes || null,
      round1PublishedAt: v1.value ? new Date() : null,
      round2PublishedAt: v2.value ? new Date() : null,
    },
    include: {
      category: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  // =========================================================================
  // Sync with PendingResultReview Queue
  // =========================================================================
  let savedReview = null;
  if (!isApprovalRequested) {
    // Draft mode: persist to PendingResultReview queue for editorial verification
    try {
      const existingPending = await db.pendingResultReview.findFirst({
        where: {
          categoryId: resolvedCategoryId,
          dateStr: targetDate,
          status: 'PENDING',
        },
      });

      const reviewPayload = {
        categoryId: resolvedCategoryId,
        dateStr: targetDate,
        proposedRound1: v1.value,
        proposedRound2: v2.value,
        currentRound1: existing?.round1 || null,
        currentRound2: existing?.round2 || null,
        reviewType: existing && (existing.round1 || existing.round2) ? 'CORRECTION_CANDIDATE' : 'NEW_RESULT',
        status: 'PENDING',
        sourceName: sourceInfo?.trim() || 'Manual Editorial Entry',
        sourceUrl: sourceEvidenceUrl?.trim() || 'https://teerresult24.com/admin/dashboard/',
        sourceEvidence: JSON.stringify({
          enteredBy: user.name || user.username || 'Admin',
          mode: 'draft_pending',
          notes: correctionReason?.trim() || notes || null,
          submittedAt: new Date().toISOString(),
        }),
      };

      if (existingPending) {
        savedReview = await db.pendingResultReview.update({
          where: { id: existingPending.id },
          data: reviewPayload,
        });
      } else {
        savedReview = await db.pendingResultReview.create({
          data: reviewPayload,
        });
      }
    } catch (revErr) {
      console.warn('[recordAdminResult] Non-fatal: error persisting to PendingResultReview:', revErr.message || revErr);
    }
  } else {
    // Approved mode: mark any matching pending reviews as APPROVED
    try {
      await db.pendingResultReview.updateMany({
        where: {
          categoryId: resolvedCategoryId,
          dateStr: targetDate,
          status: 'PENDING',
        },
        data: {
          status: 'APPROVED',
          reviewedBy: user.name || user.username || 'Admin',
          reviewedAt: new Date(),
        },
      });
    } catch (revErr) {
      console.warn('[recordAdminResult] Non-fatal: error marking pending reviews approved:', revErr.message || revErr);
    }
  }

  let message = 'Result recorded as pending verification.';
  if (nextIsVerified) {
    message = 'Result officially verified with documented provenance.';
  } else if (scoreChanged && existing?.isVerified) {
    message = 'Score was updated: previous verification revoked until fresh approval with valid evidence is submitted.';
  }

  return {
    success: true,
    message,
    result: savedResult,
    pendingReview: savedReview,
    published: nextIsVerified,
  };
}
