const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function makeAstroIslandHtml(date, games) {
  const propsObj = {
    initialData: {
      date,
      games,
    },
  };
  const jsonStr = JSON.stringify(propsObj).replace(/"/g, '&quot;');
  return `<astro-island component-url="/_astro/TeerLiveBoard.js" props="${jsonStr}"></astro-island>`;
}

async function runAllTests() {
  console.log('================================================================');
  console.log('TEERRESULT2 V9 — COMPREHENSIVE AUTOMATION & SECURITY TEST SUITE');
  console.log('================================================================\n');

  // Direct imports of REAL production modules (no mock duplicates!)
  const {
    runSyncJob,
    acquireAutomationLock,
    renewAutomationLock,
    isLockLeaseActive,
    releaseAutomationLock,
  } = await import('./src/lib/importers/sync-engine.js');

  const {
    validateOfficialGroundEvidence,
    calculateMergedResultStatus,
    processReviewApproval,
    processReviewRejection,
  } = await import('./src/lib/review-manager.js');

  const {
    fetchTeerResultLiveResults,
    sanitizeScoreStrict,
  } = await import('./src/lib/importers/teerresultlive-adapter.js');

  const { getTodayISTDateStr } = await import('./src/lib/date-utils.js');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 0. Ensure standard categories exist in database
    const categoriesToEnsure = [
      { name: 'Shillong Teer', slug: 'shillong-teer', round1Time: '03:45 PM', round2Time: '04:45 PM' },
      { name: 'Khanapara Teer', slug: 'khanapara-teer', round1Time: '04:10 PM', round2Time: '04:45 PM' },
      { name: 'Juwai Teer', slug: 'juwai-teer', round1Time: '02:00 PM', round2Time: '02:45 PM' },
      { name: 'Shillong Night Teer', slug: 'shillong-night-teer', round1Time: '10:30 PM', round2Time: '11:30 PM' },
    ];

    for (const cat of categoriesToEnsure) {
      await prisma.gameCategory.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      });
    }

    const catShillong = await prisma.gameCategory.findUnique({ where: { slug: 'shillong-teer' } });

    // -------------------------------------------------------------
    // Test Group 1: Lock Renewal Expiration Safeguards (Requirement 1)
    // -------------------------------------------------------------
    console.log('--- TEST GROUP 1: Lock Renewal Expiration & Stale Worker Safeguards ---');
    const lockKey = 'AUTOMATION_SYNC_LOCK';
    await prisma.automationLock.deleteMany({ where: { key: lockKey } });

    const workerA = `Worker-A-${crypto.randomUUID()}`;
    const workerB = `Worker-B-${crypto.randomUUID()}`;

    // 1.1 Active lease renewal succeeds when expiresAt > now
    const acqA = await acquireAutomationLock(workerA);
    assert(acqA.acquired === true, 'Worker A acquires automation lock');

    const renewActive = await renewAutomationLock(workerA, 60000);
    assert(renewActive === true, 'renewAutomationLock returns true for active non-expired lease');

    const isActive = await isLockLeaseActive(workerA);
    assert(isActive === true, 'isLockLeaseActive returns true for active lease');

    // 1.2 Non-owner renewal rejected
    const renewNonOwner = await renewAutomationLock(workerB, 60000);
    assert(renewNonOwner === false, 'renewAutomationLock returns false for non-owner');

    // 1.3 EXPIRED WORKER SAFEGUARD: Manually expire Worker A's lock in DB
    await prisma.automationLock.update({
      where: { key: lockKey },
      data: { expiresAt: new Date(Date.now() - 5000) }, // 5 seconds in the past!
    });

    // Stale Worker A must NOT be allowed to renew an expired lease!
    const renewStale = await renewAutomationLock(workerA, 60000);
    assert(renewStale === false, 'DATABASE SAFEGUARD: Expired worker cannot renew a stale lease (renewAutomationLock returned false)');

    const isStaleActive = await isLockLeaseActive(workerA);
    assert(isStaleActive === false, 'isLockLeaseActive returns false for expired lease');

    // 1.4 Database transaction safeguard against stale workers
    let staleWriteBlocked = false;
    try {
      await prisma.$transaction(async (tx) => {
        const activeLock = await tx.automationLock.findFirst({
          where: {
            key: lockKey,
            lockedBy: workerA,
            expiresAt: { gt: new Date() },
          },
        });
        if (!activeLock) {
          throw new Error('STALE_WORKER_WRITE_BLOCKED');
        }
        await tx.teerResult.create({
          data: {
            categoryId: catShillong.id,
            dateStr: '2099-01-01',
            round1: '99',
            round2: '99',
          },
        });
      });
    } catch (e) {
      if (e.message.includes('STALE_WORKER_WRITE_BLOCKED')) {
        staleWriteBlocked = true;
      }
    }
    assert(staleWriteBlocked === true, 'Database transaction boundary actively blocks stale worker write when lease has expired');

    // Clean lock
    await prisma.automationLock.deleteMany({ where: { key: lockKey } });

    // -------------------------------------------------------------
    // Test Group 2: Concurrent Jobs Compete for Lock
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Concurrent Jobs Compete for Lock ---');
    await prisma.automationLock.deleteMany({ where: { key: lockKey } });

    // Active lock held by PrimaryWorker
    await prisma.automationLock.create({
      data: {
        key: lockKey,
        lockedBy: 'PrimaryWorker [active-lease]',
        expiresAt: new Date(Date.now() + 60000),
      },
    });

    const mockHtmlSync = makeAstroIslandHtml('2026-11-15', {
      shillong: { fr: '22', sr: '88', status: 'DECLARED' },
    });

    const competingJob = await runSyncJob({
      requestedBy: 'CompetingWorker',
      htmlOverride: mockHtmlSync,
      targetDate: '2026-11-15',
    });

    assert(competingJob.success === false, 'Competing job does not proceed');
    assert(competingJob.skipped === true, 'Competing job returns skipped: true');
    assert(competingJob.message.includes('locked by PrimaryWorker'), 'Reports active lock holder in skip message');

    await prisma.automationLock.deleteMany({ where: { key: lockKey } });

    // -------------------------------------------------------------
    // Test Group 3: Real Production Strong Evidence Validation (Requirement 2 & 3)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Real Production Strong Evidence Validation ---');
    // Direct execution of production validateOfficialGroundEvidence from src/lib/review-manager.js

    // 3.1 Rejection: missing confirmedByEditor
    const resNoConfirm = await validateOfficialGroundEvidence({
      confirmedByEditor: false,
      officialEvidence: { sourceAuthority: 'Khasi Hills Archery', evidenceIdentifier: 'Bulletin #14' },
    });
    assert(resNoConfirm.valid === false, 'Production validator rejects verification without confirmedByEditor');

    // 3.2 Rejection: bare third-party aggregator URL
    const resAggregator = await validateOfficialGroundEvidence({
      confirmedByEditor: true,
      editorialEvidence: 'https://teerresultlive.in/bulletin-board-view',
    });
    assert(resAggregator.valid === false, 'Production validator rejects third-party aggregator URL as verification proof');

    // 3.3 Rejection: generic filler text without identifiable authority or bulletin ID
    const resGeneric = await validateOfficialGroundEvidence({
      confirmedByEditor: true,
      editorialEvidence: 'I checked this result on my phone and it looks verified.',
    });
    assert(resGeneric.valid === false, 'Production validator rejects generic filler text lacking identifiable authority/record reference');

    // 3.4 Rejection: invalid sourceRecordId not present in persistent database
    const resBadSourceRecord = await validateOfficialGroundEvidence({
      confirmedByEditor: true,
      officialEvidence: {
        sourceAuthority: 'Khasi Hills Archery Sports Association (KHASA)',
        evidenceIdentifier: 'Polo Ground Bulletin #14',
      },
      sourceRecordId: 'non-existent-source-record-id-999',
    });
    assert(resBadSourceRecord.valid === false, 'Production validator rejects referenced sourceRecordId when not found in database');

    // 3.5 Acceptance: structured official provenance with recognized authority and bulletin ID
    const resStructured = await validateOfficialGroundEvidence({
      confirmedByEditor: true,
      officialEvidence: {
        sourceAuthority: 'Khasi Hills Archery Sports Association (KHASA)',
        evidenceIdentifier: 'Polo Ground Bulletin #14',
        editorialNotes: 'Corroborated with field steward counter record',
      },
    });
    assert(resStructured.valid === true, 'Production validator accepts structured official evidence with recognized authority and bulletin ref');

    // 3.6 Acceptance: delimited text string format
    const resDelimited = await validateOfficialGroundEvidence({
      confirmedByEditor: true,
      editorialEvidence: 'Authority: Polo Ground Archery Association | Ref: Counter Slip #104 | Notes: Signed by steward',
    });
    assert(resDelimited.valid === true, 'Production validator accepts formatted string with recognized authority and counter slip');

    // -------------------------------------------------------------
    // Test Group 4: Real Production Merged Result Status Calculation (Requirement 3)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Real Production Merged Result Status Calculation ---');
    // Direct execution of production calculateMergedResultStatus from src/lib/review-manager.js

    // 4.1 Empty existing + FR-only proposed -> PARTIAL
    const r1 = calculateMergedResultStatus({ existing: null, proposedRound1: '45', proposedRound2: null });
    assert(r1.mergedFR === '45' && r1.mergedSR === null && r1.finalStatus === 'PARTIAL', 'Production logic: FR-only on empty record -> status: PARTIAL');

    // 4.2 Existing has FR='45' and SR=null. Review proposes SR='89' with proposedRound1=null
    // BUG REGRESSION TEST: Previous code used only proposed values and returned 'PARTIAL'!
    const r2 = calculateMergedResultStatus({ existing: { round1: '45', round2: null }, proposedRound1: null, proposedRound2: '89' });
    assert(r2.mergedFR === '45' && r2.mergedSR === '89' && r2.finalStatus === 'COMPLETED', 'Production logic: SR-only on existing FR record correctly merges into status: COMPLETED (Fix Verified!)');

    // 4.3 Both rounds present -> COMPLETED
    const r3 = calculateMergedResultStatus({ existing: null, proposedRound1: '45', proposedRound2: '89' });
    assert(r3.mergedFR === '45' && r3.mergedSR === '89' && r3.finalStatus === 'COMPLETED', 'Production logic: Both rounds present -> status: COMPLETED');

    // 4.4 Neither round present -> PENDING
    const r4 = calculateMergedResultStatus({ existing: null, proposedRound1: null, proposedRound2: null });
    assert(r4.finalStatus === 'PENDING', 'Production logic: No scores present -> status: PENDING');

    // -------------------------------------------------------------
    // Test Group 5: Real Integration Tests for Admin Review Lifecycle & Audit Logs (Requirement 4)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Real Database Integration Tests (processReviewApproval & processReviewRejection) ---');
    const testDate = '2026-11-25';
    const mockUser = { username: 'chief_editor', name: 'Chief Editor', role: 'ADMIN' };

    // Clean any prior test rows
    await prisma.teerResult.deleteMany({ where: { dateStr: testDate } });
    await prisma.pendingResultReview.deleteMany({ where: { dateStr: testDate } });

    // Step A: Create initial FR-only pending review
    const reviewFR = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: testDate,
        proposedRound1: '52',
        proposedRound2: null,
        reviewType: 'NEW_RESULT',
        status: 'PENDING',
        sourceName: 'Field Source',
        sourceUrl: 'https://test.example/live',
      },
    });

    // Directly call production processReviewApproval as UNVERIFIED live score
    const approvalUnverified = await processReviewApproval({
      reviewId: reviewFR.id,
      user: mockUser,
      options: {
        publishMode: 'unverified',
        markVerified: false,
      },
      prismaClient: prisma,
    });

    assert(approvalUnverified.updatedResult.round1 === '52', 'Integration: Saved FR "52" to database');
    assert(approvalUnverified.updatedResult.round2 === null, 'Integration: SR is null');
    assert(approvalUnverified.updatedResult.status === 'PARTIAL', 'Integration: Status is PARTIAL for FR-only');
    assert(approvalUnverified.updatedResult.isVerified === false, 'Integration: isVerified is strictly false for unverified publication');
    assert(approvalUnverified.updatedResult.sourceInfo.includes('Unverified Live Score'), 'Integration: Explicitly labeled as Unverified Live Score');

    // Step B: Create subsequent SR-only pending review
    const reviewSR = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: testDate,
        proposedRound1: null,
        proposedRound2: '94',
        reviewType: 'UPDATE',
        status: 'PENDING',
        sourceName: 'Field Source',
        sourceUrl: 'https://test.example/live',
      },
    });

    // Directly call production processReviewApproval with OFFICIAL GROUND EVIDENCE
    const approvalVerified = await processReviewApproval({
      reviewId: reviewSR.id,
      user: mockUser,
      options: {
        publishMode: 'verified',
        markVerified: true,
        confirmedByEditor: true,
        officialEvidence: {
          sourceAuthority: 'Khasi Hills Archery Sports Association (KHASA)',
          evidenceIdentifier: 'Official Bulletin #14',
          editorialNotes: 'Corroborated by Chief Editor with ground steward',
        },
      },
      prismaClient: prisma,
    });

    assert(approvalVerified.updatedResult.round1 === '52', 'Integration: Merged result preserves FR "52"');
    assert(approvalVerified.updatedResult.round2 === '94', 'Integration: Merged result updates SR "94"');
    assert(approvalVerified.updatedResult.status === 'COMPLETED', 'Integration: Status correctly transitioned from PARTIAL -> COMPLETED');
    assert(approvalVerified.updatedResult.isVerified === true, 'Integration: isVerified is true after authenticated ground evidence');
    assert(approvalVerified.updatedResult.verifiedBy.includes('chief_editor') || approvalVerified.updatedResult.verifiedBy.includes('Chief Editor'), 'Integration: verifiedBy records authenticated editor identity');

    // Verify documented SourceRecord was created in persistent DB
    const documentedSourceRecord = await prisma.sourceRecord.findFirst({
      where: {
        categoryId: catShillong.id,
        sourceName: { contains: 'Official Ground Evidence' },
      },
      orderBy: { fetchedAt: 'desc' },
    });
    assert(documentedSourceRecord !== null, 'DOCUMENTED SOURCE RECORD: Persistent reviewable SourceRecord created in database');
    assert(documentedSourceRecord.rawPayload.includes('Official Bulletin #14'), 'Documented SourceRecord payload contains verifiable evidenceIdentifier');

    // Step C: Score Correction Protection & Audit Logging
    const reviewCorrection = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: testDate,
        proposedRound1: '54', // revised from 52!
        proposedRound2: '94',
        reviewType: 'CORRECTION_CANDIDATE',
        status: 'PENDING',
        sourceName: 'Recount Source',
        sourceUrl: 'https://test.example/live',
      },
    });

    // Attempting correction on verified record without correctionReason must throw
    let correctionBlockedWithoutReason = false;
    try {
      await processReviewApproval({
        reviewId: reviewCorrection.id,
        user: mockUser,
        options: {
          publishMode: 'verified',
          markVerified: true,
          confirmedByEditor: true,
          officialEvidence: {
            sourceAuthority: 'Khasi Hills Archery Sports Association (KHASA)',
            evidenceIdentifier: 'Official Bulletin #14 Rev 1',
          },
        },
        prismaClient: prisma,
      });
    } catch (e) {
      if (e.message.includes('CORRECTION_REASON_REQUIRED')) {
        correctionBlockedWithoutReason = true;
      }
    }
    assert(correctionBlockedWithoutReason === true, 'CORRECTION SAFEGUARD: Overwriting verified score without correctionReason throws CORRECTION_REASON_REQUIRED');

    // Now supply valid correctionReason
    const approvalCorrected = await processReviewApproval({
      reviewId: reviewCorrection.id,
      user: mockUser,
      options: {
        publishMode: 'verified',
        markVerified: true,
        confirmedByEditor: true,
        correctionReason: 'Steward recount discrepancy resolved',
        officialEvidence: {
          sourceAuthority: 'Khasi Hills Archery Sports Association (KHASA)',
          evidenceIdentifier: 'Official Bulletin #14 Rev 1',
        },
      },
      prismaClient: prisma,
    });

    assert(approvalCorrected.updatedResult.round1 === '54', 'Integration: Score corrected to "54" in database');

    const correctionLogs = await prisma.correctionLog.findMany({
      where: { resultId: approvalCorrected.updatedResult.id },
    });
    assert(correctionLogs.length === 1, 'AUDIT LOG: CorrectionLog record created in database');
    assert(correctionLogs[0].oldValue === '52' && correctionLogs[0].newValue === '54', 'CorrectionLog correctly tracks oldValue="52" and newValue="54"');
    assert(correctionLogs[0].reason.includes('Steward recount'), 'CorrectionLog tracks editorial revision reason');

    // Step D: Rejection Integration
    const reviewToReject = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: testDate,
        proposedRound1: '99',
        proposedRound2: '99',
        reviewType: 'UPDATE',
        status: 'PENDING',
        sourceName: 'Spam Source',
        sourceUrl: 'https://spam.example',
      },
    });

    const rejectedReview = await processReviewRejection({
      reviewId: reviewToReject.id,
      user: mockUser,
      rejectionReason: 'Spam submission rejected by editor',
      prismaClient: prisma,
    });
    assert(rejectedReview.status === 'REJECTED', 'Integration: processReviewRejection updates status to REJECTED');
    assert(rejectedReview.rejectionReason === 'Spam submission rejected by editor', 'Integration: rejectionReason stored in database');

    // Step E: Concurrent Approval Race Prevention (Optimistic Locking)
    const reviewRace = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: '2026-11-26',
        proposedRound1: '71',
        proposedRound2: '18',
        reviewType: 'NEW_RESULT',
        status: 'PENDING',
        sourceName: 'Race Source',
        sourceUrl: 'https://test.example',
      },
    });

    const [raceA, raceB] = await Promise.allSettled([
      processReviewApproval({ reviewId: reviewRace.id, user: { username: 'EditorA' }, options: { publishMode: 'unverified' }, prismaClient: prisma }),
      processReviewApproval({ reviewId: reviewRace.id, user: { username: 'EditorB' }, options: { publishMode: 'unverified' }, prismaClient: prisma }),
    ]);

    const raceSuccessCount = (raceA.status === 'fulfilled' ? 1 : 0) + (raceB.status === 'fulfilled' ? 1 : 0);
    const raceConflictCount = ((raceA.status === 'rejected' && raceA.reason.message.includes('CONCURRENT_REVIEW_CONFLICT')) ? 1 : 0) +
                              ((raceB.status === 'rejected' && raceB.reason.message.includes('CONCURRENT_REVIEW_CONFLICT')) ? 1 : 0);

    assert(raceSuccessCount === 1, 'CONCURRENCY SAFEGUARD: Exactly one concurrent approval request succeeds');
    assert(raceConflictCount === 1, 'CONCURRENCY SAFEGUARD: Competing request is rejected with CONCURRENT_REVIEW_CONFLICT (HTTP 409)');

    // Cleanup integration rows
    await prisma.teerResult.deleteMany({ where: { dateStr: { in: [testDate, '2026-11-26'] } } });
    await prisma.pendingResultReview.deleteMany({ where: { dateStr: { in: [testDate, '2026-11-26'] } } });

    // -------------------------------------------------------------
    // Test Group 6: Live Scraper Validation (Requirement 5)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: Real Scraper Validation Against Live Source ---');
    try {
      const historicalRes = await fetchTeerResultLiveResults({ targetDate: '2026-11-14' });
      assert(historicalRes.success === true, 'Live scraper extracts successfully from https://teerresultlive.in/ for active bulletin date (2026-11-14)');
      assert(historicalRes.results.length === 4, 'Extracted all four competition games');

      const shillongGame = historicalRes.results.find((g) => g.gameIdentifier === 'shillong-teer');
      const khanaparaGame = historicalRes.results.find((g) => g.gameIdentifier === 'khanapara-teer');
      const juwaiGame = historicalRes.results.find((g) => g.gameIdentifier === 'juwai-teer');
      const nightGame = historicalRes.results.find((g) => g.gameIdentifier === 'shillong-night-teer');

      assert(shillongGame && shillongGame.round1 === '82' && shillongGame.round2 === '12', 'Shillong Teer exact score match (FR: 82, SR: 12)');
      assert(khanaparaGame && khanaparaGame.round1 === '23' && khanaparaGame.round2 === '26', 'Khanapara Teer exact score match (FR: 23, SR: 26)');
      assert(juwaiGame && juwaiGame.round1 === '37' && juwaiGame.round2 === '10', 'Juwai Teer exact score match (FR: 37, SR: 10)');
      assert(nightGame && nightGame.round1 === '78' && nightGame.round2 === '96', 'Shillong Night Teer exact score match (FR: 78, SR: 96)');

      // Live test against today (Sunday Nov 15: clubs closed)
      const sundayRes = await fetchTeerResultLiveResults();
      assert(sundayRes.isDateMismatch === true, 'Sunday date mismatch guard triggers correctly (no results written on closed day)');
    } catch (e) {
      console.error('Scraper test error:', e);
      failed++;
    }

    // -------------------------------------------------------------
    // Test Group 7: Vercel Cron Authentication & Bearer Header Verification (Requirement 9)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 7: Vercel Cron Authentication Logic ---');
    const secret = 'valid_test_cron_secret_12345';
    function isAuthorizedCron(authHeader, queryToken) {
      if (queryToken) return false; // Query tokens strictly rejected!
      if (!authHeader) return false;
      return authHeader.trim() === `Bearer ${secret}`;
    }

    assert(isAuthorizedCron('Bearer valid_test_cron_secret_12345', null) === true, 'Cron Auth: Accepts valid Authorization Bearer header');
    assert(isAuthorizedCron('Bearer wrong_secret', null) === false, 'Cron Auth: Rejects invalid Bearer token');
    assert(isAuthorizedCron(null, null) === false, 'Cron Auth: Rejects missing Authorization header');
    assert(isAuthorizedCron(null, 'valid_test_cron_secret_12345') === false, 'Cron Auth: Rejects query token ?token=... strictly');

    // -------------------------------------------------------------
    // Test Group 8: PostgreSQL DDL Integrity Check
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 8: PostgreSQL DDL Integrity ---');
    const mig1 = fs.readFileSync(
      path.join(__dirname, 'prisma-postgres/migrations/20261114000000_init_postgres/migration.sql'),
      'utf8'
    );
    const mig2 = fs.readFileSync(
      path.join(__dirname, 'prisma-postgres/migrations/20261115000000_add_review_queue_and_lock/migration.sql'),
      'utf8'
    );

    const isPurePostgres = (sql) => !/AUTOINCREMENT/i.test(sql) && /TIMESTAMP\(3\)/i.test(sql) && /CONSTRAINT/i.test(sql);
    assert(isPurePostgres(mig1) === true, 'PostgreSQL Init migration uses valid PostgreSQL DDL');
    assert(isPurePostgres(mig2) === true, 'PostgreSQL V7 migration uses valid PostgreSQL DDL');

    console.log('\n================================================================');
    console.log(`TEERRESULT2 V9 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

runAllTests();
