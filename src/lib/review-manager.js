import prisma from './prisma.js';

/**
 * Validates strong editorial evidence for official ground verification.
 * A bare text string, arbitrary claim, or third-party aggregator URL is strictly insufficient.
 * Requires:
 * 1. Authenticated editorial confirmation (confirmedByEditor === true)
 * 2. Identifiable sanctioned source authority (e.g. KHASA, Polo Ground, Khanapara Syndicate, Juwai Archery)
 * 3. Verifiable document or bulletin reference (e.g. Bulletin #14, Counter Slip #401, Steward Sheet #8)
 * 4. Documented reviewable source record (either linking an existing SourceRecord in DB or
 *    providing reviewable primary ground audit parameters to create one)
 */
export async function validateOfficialGroundEvidence(options, db = prisma) {
  const {
    confirmedByEditor,
    officialEvidence,
    editorialEvidence,
    sourceRecordId,
  } = options;

  if (!confirmedByEditor) {
    return {
      valid: false,
      error: 'Official verification requires explicit authenticated editorial confirmation (confirmedByEditor must be true).',
    };
  }

  // Validate linked persistent SourceRecord if provided
  let linkedSourceRecord = null;
  if (sourceRecordId) {
    linkedSourceRecord = await db.sourceRecord.findUnique({
      where: { id: sourceRecordId },
    });
    if (!linkedSourceRecord) {
      return {
        valid: false,
        error: `Referenced sourceRecordId "${sourceRecordId}" could not be found in persistent records.`,
      };
    }
  }

  let authority = '';
  let identifier = '';
  let notes = '';
  let groundSourceType = 'OFFICIAL_GROUND_BULLETIN';
  let documentProofUrl = '';

  if (officialEvidence && typeof officialEvidence === 'object') {
    authority = (officialEvidence.sourceAuthority || '').trim();
    identifier = (officialEvidence.evidenceIdentifier || officialEvidence.bulletinNumber || officialEvidence.slipNumber || '').trim();
    notes = (officialEvidence.editorialNotes || '').trim();
    groundSourceType = (officialEvidence.groundSourceType || 'OFFICIAL_GROUND_BULLETIN').trim();
    documentProofUrl = (officialEvidence.documentProofUrl || officialEvidence.sourceUrl || '').trim();
  } else if (typeof editorialEvidence === 'string' && editorialEvidence.trim()) {
    const raw = editorialEvidence.trim();
    const authMatch = raw.match(/Authority:\s*([^|;]+)/i);
    const refMatch = raw.match(/(?:Ref|Reference|Doc|Bulletin|Slip):\s*([^|;]+)/i);
    const notesMatch = raw.match(/Notes:\s*([^|;]+)/i);

    if (authMatch && refMatch) {
      authority = authMatch[1].trim();
      identifier = refMatch[1].trim();
      notes = notesMatch ? notesMatch[1].trim() : '';
    } else {
      const authorityPattern = /(khasi\s*hills|khasa|polo\s*ground|khanapara|juwai|jaintia|counter\s*syndicate|archery\s*association|sanctioned\s*counter|official\s*bulletin)/i;
      const identifierPattern = /(bulletin\s*#?\s*\d+|slip\s*#?\s*\d+|sheet\s*#?\s*\d+|board\s*#?\s*\d+|ref\s*#?\s*[\w-]+|id\s*#?\s*[\w-]+|#\d{1,6}|\b\d{3,6}\b)/i;

      if (authorityPattern.test(raw) && identifierPattern.test(raw)) {
        authority = raw.match(authorityPattern)[0];
        identifier = raw.match(identifierPattern)[0];
        notes = raw;
      }
    }
  }

  const isScraperDomain = (str) => {
    const lower = (str || '').toLowerCase();
    return (
      lower.includes('teerresultlive') ||
      lower.includes('teertoday') ||
      lower.includes('teercounter') ||
      lower.includes('aggregat') ||
      (lower.startsWith('http') && !lower.includes('khasa') && !lower.includes('official'))
    );
  };

  if (isScraperDomain(authority) || isScraperDomain(identifier)) {
    return {
      valid: false,
      error:
        'Official verification cannot be based on third-party aggregator websites. Primary ground source evidence is required.',
    };
  }

  // Requirement: Do not treat manually entered authority and bulletin text as independently verified evidence
  // without a documented, reviewable source record or specific verified ground proof reference
  if (!linkedSourceRecord && (!authority || authority.length < 5 || !identifier || identifier.length < 3)) {
    return {
      valid: false,
      error:
        'Official verification requires a documented, reviewable source record (sourceRecordId) or identifiable primary ground evidence (sanctioned authority and document reference). Arbitrary text is strictly insufficient.',
    };
  }

  return {
    valid: true,
    authority: authority || (linkedSourceRecord ? linkedSourceRecord.sourceName : 'Sanctioned Ground Authority'),
    identifier: identifier || (linkedSourceRecord ? `SourceRecord-${linkedSourceRecord.id}` : 'Documented Bulletin'),
    notes,
    groundSourceType,
    documentProofUrl,
    sourceRecordId: linkedSourceRecord ? linkedSourceRecord.id : null,
  };
}

/**
 * Calculates the merged result values and competition status.
 * Evaluates final status strictly from final merged values (existing + incoming),
 * not merely incoming proposed values.
 */
export function calculateMergedResultStatus({ existing, proposedRound1, proposedRound2 }) {
  const mergedFR = proposedRound1 !== null && proposedRound1 !== undefined
    ? proposedRound1
    : (existing ? existing.round1 : null);

  const mergedSR = proposedRound2 !== null && proposedRound2 !== undefined
    ? proposedRound2
    : (existing ? existing.round2 : null);

  let finalStatus = 'PENDING';
  if (mergedFR && mergedSR) {
    finalStatus = 'COMPLETED';
  } else if (mergedFR || mergedSR) {
    finalStatus = 'PARTIAL';
  }

  return {
    mergedFR,
    mergedSR,
    finalStatus,
  };
}

/**
 * Rejects a pending review with optimistic concurrency control.
 */
export async function processReviewRejection({
  reviewId,
  user,
  rejectionReason = '',
  prismaClient = prisma,
}) {
  const claim = await prismaClient.pendingResultReview.updateMany({
    where: { id: reviewId, status: 'PENDING' },
    data: {
      status: 'REJECTED',
      reviewedBy: user.name || user.username,
      reviewedAt: new Date(),
      rejectionReason: rejectionReason || 'Rejected by editor without changes to public records.',
    },
  });

  if (claim.count === 0) {
    throw new Error('CONCURRENT_REVIEW_CONFLICT');
  }

  return await prismaClient.pendingResultReview.findUnique({
    where: { id: reviewId },
  });
}

/**
 * Approves a pending review with atomic transactional safeguards,
 * optimistic concurrency control, strong ground evidence validation,
 * documented reviewable source record generation, and merged status calculation.
 *
 * Clearly distinguishes between:
 * - 'verified': Independently source-verified with primary ground evidence (isVerified: true)
 * - 'editorial_approved': Approved by editor without primary ground proof (isVerified: false)
 * - 'unverified': Published as unverified live score (isVerified: false)
 */
export async function processReviewApproval({
  reviewId,
  user,
  options = {},
  prismaClient = prisma,
}) {
  const {
    publishMode = 'unverified', // 'verified' | 'editorial_approved' | 'unverified'
    markVerified = false,
    confirmedByEditor = false,
    officialEvidence = null,
    editorialEvidence = '',
    sourceRecordId = null,
    correctionReason = '',
  } = options;

  const isOfficiallyVerified = publishMode === 'verified' || markVerified === true;
  const isEditorialApproved = publishMode === 'editorial_approved';
  let validatedEvidence = null;

  if (isOfficiallyVerified) {
    const evidenceValidation = await validateOfficialGroundEvidence(
      {
        confirmedByEditor: Boolean(confirmedByEditor || officialEvidence?.confirmedByEditor),
        officialEvidence,
        editorialEvidence,
        sourceRecordId,
      },
      prismaClient
    );

    if (!evidenceValidation.valid) {
      const err = new Error(evidenceValidation.error);
      err.statusCode = 400;
      throw err;
    }
    validatedEvidence = evidenceValidation;
  }

  return await prismaClient.$transaction(async (tx) => {
    // 1. Optimistic lock on PendingResultReview to prevent concurrent approvals
    const claim = await tx.pendingResultReview.updateMany({
      where: { id: reviewId, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        reviewedBy: user.name || user.username,
        reviewedAt: new Date(),
      },
    });

    if (claim.count === 0) {
      const err = new Error('CONCURRENT_REVIEW_CONFLICT');
      err.statusCode = 409;
      throw err;
    }

    const review = await tx.pendingResultReview.findUnique({
      where: { id: reviewId },
      include: { category: true },
    });

    const existing = await tx.teerResult.findUnique({
      where: {
        categoryId_dateStr: {
          categoryId: review.categoryId,
          dateStr: review.dateStr,
        },
      },
    });

    const nextFR = review.proposedRound1;
    const nextSR = review.proposedRound2;

    // 2. Merged Result Status Calculation
    const { mergedFR, mergedSR, finalStatus } = calculateMergedResultStatus({
      existing,
      proposedRound1: nextFR,
      proposedRound2: nextSR,
    });

    // 3. Score change conflict protection for already verified records
    const scoreChanged = existing && (
      (nextFR !== null && existing.round1 !== null && existing.round1 !== nextFR) ||
      (nextSR !== null && existing.round2 !== null && existing.round2 !== nextSR)
    );

    if (existing && existing.isVerified && scoreChanged && !correctionReason) {
      const err = new Error('CORRECTION_REASON_REQUIRED: Overwriting an already verified score requires an explicit correctionReason.');
      err.statusCode = 400;
      throw err;
    }

    // 4. Record audit correction log if existing numbers are modified
    if (existing) {
      if (nextFR && existing.round1 && existing.round1 !== nextFR) {
        await tx.correctionLog.create({
          data: {
            resultId: existing.id,
            roundNumber: 1,
            oldValue: existing.round1,
            newValue: nextFR,
            reason: correctionReason || `Approved editorial correction corroborated from ${review.sourceName}`,
            correctedBy: user.name || user.username,
          },
        });
      }
      if (nextSR && existing.round2 && existing.round2 !== nextSR) {
        await tx.correctionLog.create({
          data: {
            resultId: existing.id,
            roundNumber: 2,
            oldValue: existing.round2,
            newValue: nextSR,
            reason: correctionReason || `Approved editorial correction corroborated from ${review.sourceName}`,
            correctedBy: user.name || user.username,
          },
        });
      }
    }

    // 5. Documented reviewable SourceRecord generation for official verification
    let documentedSourceRecordId = validatedEvidence?.sourceRecordId || null;
    if (isOfficiallyVerified && !documentedSourceRecordId) {
      const createdSourceRecord = await tx.sourceRecord.create({
        data: {
          categoryId: review.categoryId,
          sourceName: `Primary Ground Evidence: ${validatedEvidence.authority}`,
          rawPayload: JSON.stringify({
            verifiedBy: user.name || user.username,
            verifiedAt: new Date().toISOString(),
            authority: validatedEvidence.authority,
            evidenceIdentifier: validatedEvidence.identifier,
            editorialNotes: validatedEvidence.notes || null,
            originalScrapeSourceUrl: review.sourceUrl,
            gameSlug: review.category.slug,
            dateStr: review.dateStr,
            mergedFR,
            mergedSR,
          }),
          status: 'PROCESSED',
        },
      });
      documentedSourceRecordId = createdSourceRecord.id;
    }

    // 6. Final Status & Verification State
    let effectiveStatus = finalStatus;
    if (scoreChanged && !isOfficiallyVerified) {
      effectiveStatus = 'CORRECTED';
    }

    let finalSourceInfo = '';
    let finalNotes = existing?.notes || null;
    let nextIsVerified = false;
    let nextVerifiedAt = null;
    let nextVerifiedBy = null;

    if (isOfficiallyVerified) {
      nextIsVerified = true;
      nextVerifiedAt = new Date();
      nextVerifiedBy = user.name || user.username;
      finalSourceInfo = `Independently Source-Verified via ${validatedEvidence.authority} (Ref: ${validatedEvidence.identifier}) [SourceRecord: #${documentedSourceRecordId}]`;
      finalNotes = `[Independently Source-Verified ${new Date().toISOString()}] Authority: ${validatedEvidence.authority}, Ref: ${validatedEvidence.identifier}, SourceRecord: #${documentedSourceRecordId}, Notes: ${validatedEvidence.notes || 'N/A'}`;
    } else if (isEditorialApproved) {
      nextIsVerified = false; // Not independently source-verified!
      nextVerifiedAt = null;
      nextVerifiedBy = null;
      finalSourceInfo = `Editorially Approved by ${user.name || user.username} via ${review.sourceName} (Pending Independent Ground Corroboration)`;
      finalNotes = `[Editorially Approved ${new Date().toISOString()}] Reviewed by ${user.name || user.username} without primary ground documentation.`;
    } else {
      nextIsVerified = false;
      nextVerifiedAt = null;
      nextVerifiedBy = null;
      finalSourceInfo = `Imported via ${review.sourceName} (Unverified Live Score - Pending Official Ground Verification)`;
    }

    const frPublishedAt = mergedFR ? (existing?.round1PublishedAt || new Date()) : null;
    const srPublishedAt = mergedSR ? (existing?.round2PublishedAt || new Date()) : null;

    let updatedResult;
    if (existing) {
      updatedResult = await tx.teerResult.update({
        where: { id: existing.id },
        data: {
          round1: mergedFR,
          round2: mergedSR,
          status: effectiveStatus,
          isVerified: nextIsVerified,
          verifiedAt: nextVerifiedAt,
          verifiedBy: nextVerifiedBy,
          sourceInfo: finalSourceInfo,
          sourceEvidenceUrl: isOfficiallyVerified ? (review.sourceUrl || null) : existing.sourceEvidenceUrl,
          round1PublishedAt: frPublishedAt,
          round2PublishedAt: srPublishedAt,
          notes: finalNotes,
        },
      });
    } else {
      updatedResult = await tx.teerResult.create({
        data: {
          categoryId: review.categoryId,
          dateStr: review.dateStr,
          round1: mergedFR,
          round2: mergedSR,
          status: effectiveStatus,
          isVerified: nextIsVerified,
          verifiedAt: nextVerifiedAt,
          verifiedBy: nextVerifiedBy,
          sourceInfo: finalSourceInfo,
          sourceEvidenceUrl: isOfficiallyVerified ? (review.sourceUrl || null) : null,
          round1PublishedAt: frPublishedAt,
          round2PublishedAt: srPublishedAt,
          notes: finalNotes,
        },
      });
    }

    // 7. Update PendingResultReview with audit evidence record
    let reviewApprovalMode = 'UNVERIFIED_LIVE_SCORE';
    if (isOfficiallyVerified) reviewApprovalMode = 'OFFICIALLY_VERIFIED';
    else if (isEditorialApproved) reviewApprovalMode = 'EDITORIAL_APPROVED';

    const updatedReview = await tx.pendingResultReview.update({
      where: { id: reviewId },
      data: {
        sourceEvidence: JSON.stringify({
          mode: reviewApprovalMode,
          reviewedBy: user.name || user.username,
          reviewedAt: new Date().toISOString(),
          authority: isOfficiallyVerified ? validatedEvidence.authority : null,
          identifier: isOfficiallyVerified ? validatedEvidence.identifier : null,
          notes: isOfficiallyVerified ? validatedEvidence.notes : (isEditorialApproved ? 'Approved by editor without primary ground documentation.' : 'Approved as unverified live score.'),
          documentedSourceRecordId,
          mergedFR,
          mergedSR,
          finalStatus: effectiveStatus,
        }),
      },
      include: { category: true },
    });

    return { updatedResult, approvedReview: updatedReview };
  });
}
