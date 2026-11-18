/**
 * TeerResult2 — Admin Result Publishing & Provenance Service
 * Encapsulates validation, dynamic category resolution, atomic persistence,
 * revision auditing, and provenance verification.
 */

import prisma from './prisma.js';
import { validateTeerNumber, getTodayISTDateStr, isValidCalendarDate } from './date-utils.js';
import { ensureOfficialCategories, resolveCanonicalCategorySlug } from './categories.js';

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
 * @param {string} [params.action='submit'] - 'submit' (draft/pending verification) or 'approve_and_verify'
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
  } = params;

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

  // Verification requirements validation
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

  // Dynamic Category Resolution:
  // Resolves category whether categoryId is a canonical slug, legacy identifier (e.g. cat_khanapara_teer), database CUID, or human name
  const canonicalSlug = resolveCanonicalCategorySlug(cleanCatInput);
  const whereOr = [
    { slug: canonicalSlug },
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

    // If category not found, attempt safe idempotent auto-seed and query again
    if (!category) {
      await ensureOfficialCategories(db).catch((seedErr) => {
        console.warn('[recordAdminResult] ensureOfficialCategories warning:', seedErr.message || seedErr);
      });
      category = await db.gameCategory.findFirst({
        where: { OR: whereOr },
      });
    }
  } catch (catLookupErr) {
    console.warn('[recordAdminResult] Database error resolving category:', catLookupErr.message || catLookupErr);
    try {
      await ensureOfficialCategories(db);
      category = await db.gameCategory.findFirst({
        where: { OR: whereOr },
      });
    } catch {}
  }

  if (!category) {
    const err = new Error(`Invalid competition category "${cleanCatInput}". Category could not be resolved in the database.`);
    err.statusCode = 400;
    throw err;
  }

  const resolvedCategoryId = category.id;

  // Check existing record
  const existing = await db.teerResult.findUnique({
    where: {
      categoryId_dateStr: {
        categoryId: resolvedCategoryId,
        dateStr: targetDate,
      },
    },
  });

  const round1Changed = existing ? (existing.round1 !== v1.value) : false;
  const round2Changed = existing ? (existing.round2 !== v2.value) : false;
  const scoreChanged = round1Changed || round2Changed;

  // Log official revisions/corrections into audit table safely
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

  // Determine verification metadata:
  // If a score changed, any previous verification is REVOKED unless fresh authenticated approval is provided.
  let nextIsVerified = false;
  let nextVerifiedAt = null;
  let nextVerifiedBy = null;
  let nextEvidenceUrl = null;

  if (existing) {
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
  } else {
    // New record (Pending verification by default unless approved with valid URL)
    nextIsVerified = isApprovalRequested;
    nextVerifiedAt = isApprovalRequested ? new Date() : null;
    nextVerifiedBy = isApprovalRequested ? (user.name || user.username) : null;
    nextEvidenceUrl = validatedEvidenceUrl;
  }

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

  // Atomic database upsert — single-statement execution safe for Cloudflare Hyperdrive pooling
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
      sourceEvidenceUrl: nextEvidenceUrl,
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
      sourceEvidenceUrl: nextEvidenceUrl,
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
  };
}
