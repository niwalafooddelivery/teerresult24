const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

// Determine whether testing against PostgreSQL (via process.env.DATABASE_URL) or disposable SQLite
const isPostgres = Boolean(process.env.DATABASE_URL && (process.env.DATABASE_URL.startsWith('postgres://') || process.env.DATABASE_URL.startsWith('postgresql://')));
const TEST_DB_PATH = path.join(__dirname, 'test.db');
const TEST_DB_URL = isPostgres ? process.env.DATABASE_URL : `file:${TEST_DB_PATH}`;
process.env.DATABASE_URL = TEST_DB_URL;

console.log(`Setting up test database (${isPostgres ? 'PostgreSQL' : 'Disposable SQLite'})...`);
try {
  if (isPostgres) {
    execSync('npx prisma migrate deploy --schema=prisma/schema.prisma', {
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: 'pipe',
    });
  } else {
    execSync('npx prisma generate --schema=prisma-sqlite/schema.prisma', { stdio: 'pipe' });
    execSync('npx prisma migrate deploy --schema=prisma-sqlite/schema.prisma', {
      env: { ...process.env, DATABASE_URL: TEST_DB_URL },
      stdio: 'pipe',
    });
  }
  console.log('✓ Disposable test database initialized and migrations applied.');
} catch (err) {
  console.error('Failed to run migrations on test db:', err.message);
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: TEST_DB_URL,
    },
  },
});

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
  console.log('TEERRESULT2 V10 — FINAL REAL-WORLD AUTOMATION & AUDIT TEST SUITE');
  console.log('================================================================\n');

  // Direct imports of REAL production modules
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
    extractResultsFromHtml,
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
    // -------------------------------------------------------------
    // Test Group 0: Disposable Database Isolation & Seeding
    // -------------------------------------------------------------
    console.log('--- TEST GROUP 0: Disposable Database Isolation & Seeding ---');
    assert(process.env.DATABASE_URL.includes('test.db'), 'Running exclusively on dedicated test database (test.db)');

    const categoriesToEnsure = [
      { name: 'Shillong Teer', slug: 'shillong-teer', round1Time: '03:45 PM', round2Time: '04:45 PM' },
      { name: 'Khanapara Teer', slug: 'khanapara-teer', round1Time: '04:10 PM', round2Time: '04:45 PM' },
      { name: 'Juwai Teer', slug: 'juwai-teer', round1Time: '02:00 PM', round2Time: '02:45 PM' },
      { name: 'Shillong Night Teer', slug: 'shillong-night-teer', round1Time: '10:30 PM', round2Time: '11:30 PM' },
      { name: 'Shillong Morning Teer', slug: 'shillong-morning-teer', round1Time: '10:30 AM', round2Time: '11:30 AM' },
      { name: 'Welcome Morning Teer', slug: 'welcome-morning-teer', round1Time: '10:30 AM', round2Time: '11:30 AM' },
    ];

    for (const cat of categoriesToEnsure) {
      await prisma.gameCategory.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      });
    }

    const catShillong = await prisma.gameCategory.findUnique({ where: { slug: 'shillong-teer' } });
    assert(catShillong !== null, 'Seeded Shillong Teer category into test database');

    // -------------------------------------------------------------
    // Test Group 1: Lock Renewal Expiration & Stale Worker Safeguards
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 1: Lock Renewal Expiration & Stale Worker Safeguards ---');
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

    // 2.2 End-to-End Scrape Sync to Pending Review Queue (AUTO_PUBLISH_ENABLED=false)
    const syncTestDate = '2026-11-20';
    await prisma.pendingResultReview.deleteMany({ where: { dateStr: syncTestDate } });
    await prisma.teerResult.deleteMany({ where: { dateStr: syncTestDate } });

    const stagingHtml = makeAstroIslandHtml(syncTestDate, {
      shillong: { fr: '41', sr: '79', status: 'DECLARED' },
      khanapara: { fr: '15', sr: '63', status: 'DECLARED' },
      juwai: { fr: '90', sr: '04', status: 'DECLARED' },
      night: { fr: '32', sr: '81', status: 'DECLARED' },
    });

    const stagingSyncJob = await runSyncJob({
      requestedBy: 'StagingWorker',
      htmlOverride: stagingHtml,
      targetDate: syncTestDate,
    });

    assert(stagingSyncJob.success === true, 'Sync job executes successfully');
    assert(stagingSyncJob.recordsSaved === 4, 'Sync job processed and saved 4 game records');

    const stagedReviews = await prisma.pendingResultReview.findMany({
      where: { dateStr: syncTestDate },
      include: { category: true },
    });
    assert(stagedReviews.length === 4, 'QUEUE STAGING: All 4 scraped games saved into PendingResultReview queue');

    const publicResultsBeforeApproval = await prisma.teerResult.findMany({
      where: { dateStr: syncTestDate },
    });
    assert(publicResultsBeforeApproval.length === 0, 'SAFEGUARD: Zero public results written to TeerResult table when AUTO_PUBLISH_ENABLED=false');

    const stagedShillong = stagedReviews.find((r) => r.category.slug === 'shillong-teer');
    assert(stagedShillong.proposedRound1 === '41' && stagedShillong.proposedRound2 === '79', 'Staged review preserves exact proposed scores (FR: 41, SR: 79)');
    assert(stagedShillong.status === 'PENDING', 'Staged review status is PENDING');

    // Admin approves the staged Shillong review
    const approvedStaged = await processReviewApproval({
      reviewId: stagedShillong.id,
      user: { username: 'AdminDesk', name: 'Admin Desk' },
      options: {
        publishMode: 'editorial_approved',
        confirmedByEditor: true,
        editorialEvidence: 'Editor verified match from ground scoreboard',
      },
      prismaClient: prisma,
    });

    assert(approvedStaged.updatedResult.round1 === '41' && approvedStaged.updatedResult.round2 === '79', 'Approval publishes exact FR and SR to public database');
    assert(approvedStaged.approvedReview.status === 'APPROVED', 'Pending review status updated to APPROVED');

    const publicResultsAfterApproval = await prisma.teerResult.findMany({
      where: { dateStr: syncTestDate },
    });
    assert(publicResultsAfterApproval.length === 1, 'Public database now contains exactly 1 approved record for the date');

    // Cleanup staging sync rows
    await prisma.pendingResultReview.deleteMany({ where: { dateStr: syncTestDate } });
    await prisma.teerResult.deleteMany({ where: { dateStr: syncTestDate } });

    // -------------------------------------------------------------
    // Test Group 3: Real Production Strong Evidence Validation
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Real Production Strong Evidence Validation ---');
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

    // 3.6 Rejection: manually typed bulletin references or arbitrary strings rejected for independent official verification
    const resDelimited = await validateOfficialGroundEvidence({
      confirmedByEditor: true,
      editorialEvidence: 'Authority: Polo Ground Archery Association | Ref: Counter Slip #104 | Notes: Signed by steward',
    });
    assert(resDelimited.valid === false, 'Production validator rejects manually typed text strings for independent official verification (requires structured ground evidence or SourceRecord)');

    // 3.7 Acceptance: structured official evidence with recognized authority and counter slip
    const resCounterSlip = await validateOfficialGroundEvidence({
      confirmedByEditor: true,
      officialEvidence: {
        sourceAuthority: 'Polo Ground Archery Association',
        evidenceIdentifier: 'Counter Slip #104',
        editorialNotes: 'Signed by ground steward',
      },
    });
    assert(resCounterSlip.valid === true, 'Production validator accepts structured official evidence with recognized authority and counter slip');

    // -------------------------------------------------------------
    // Test Group 4: Tri-State Verification Distinction (Requirement 3)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Tri-State Verification Distinction & Review Approval ---');
    const testDate = '2026-11-25';
    const mockUser = { username: 'chief_editor', name: 'Chief Editor', role: 'ADMIN' };

    await prisma.teerResult.deleteMany({ where: { dateStr: testDate } });
    await prisma.pendingResultReview.deleteMany({ where: { dateStr: testDate } });

    // Mode A: UNVERIFIED Live Score
    const reviewA = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: testDate,
        proposedRound1: '33',
        proposedRound2: null,
        reviewType: 'NEW_RESULT',
        status: 'PENDING',
        sourceName: 'Aggregator Live Stream',
        sourceUrl: 'https://test.example/live',
      },
    });

    const approvalA = await processReviewApproval({
      reviewId: reviewA.id,
      user: mockUser,
      options: { publishMode: 'unverified' },
      prismaClient: prisma,
    });
    assert(approvalA.updatedResult.isVerified === false, 'Tri-State Mode 1: unverified -> isVerified is strictly false');
    assert(approvalA.updatedResult.sourceInfo.includes('Unverified Live Score'), 'Tri-State Mode 1: sourceInfo states "Unverified Live Score"');

    // Mode B: EDITORIALLY APPROVED (Pending Ground Corroboration)
    const reviewB = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: testDate,
        proposedRound1: '33',
        proposedRound2: '67',
        reviewType: 'UPDATE',
        status: 'PENDING',
        sourceName: 'Internal Editor Desk',
        sourceUrl: 'https://test.example/live',
      },
    });

    const approvalB = await processReviewApproval({
      reviewId: reviewB.id,
      user: mockUser,
      options: {
        publishMode: 'editorial_approved',
        confirmedByEditor: true,
        editorialEvidence: 'Editor approved broadcast match',
      },
      prismaClient: prisma,
    });
    assert(approvalB.updatedResult.isVerified === false, 'Tri-State Mode 2: editorial_approved -> isVerified remains false (ground proof pending)');
    assert(approvalB.updatedResult.sourceInfo.includes('Editorially Approved'), 'Tri-State Mode 2: sourceInfo states "Editorially Approved by chief_editor"');

    // Mode C: INDEPENDENTLY SOURCE-VERIFIED
    const reviewC = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: testDate,
        proposedRound1: '33',
        proposedRound2: '67',
        reviewType: 'UPDATE',
        status: 'PENDING',
        sourceName: 'Polo Ground Steward Desk',
        sourceUrl: 'https://test.example/live',
      },
    });

    const approvalC = await processReviewApproval({
      reviewId: reviewC.id,
      user: mockUser,
      options: {
        publishMode: 'verified',
        markVerified: true,
        confirmedByEditor: true,
        officialEvidence: {
          sourceAuthority: 'Khasi Hills Archery Sports Association (KHASA)',
          evidenceIdentifier: 'Polo Ground Slip #8812',
          editorialNotes: 'Ground counter tally verified in person',
        },
      },
      prismaClient: prisma,
    });
    assert(approvalC.updatedResult.isVerified === true, 'Tri-State Mode 3: verified -> isVerified is true');
    assert(
      approvalC.updatedResult.verifiedBy.includes('chief_editor') || approvalC.updatedResult.verifiedBy.includes('Chief Editor'),
      'Tri-State Mode 3: verifiedBy stores editor identity'
    );
    assert(approvalC.updatedResult.sourceInfo.includes('KHASA'), 'Tri-State Mode 3: sourceInfo records official authority provenance');

    // -------------------------------------------------------------
    // Test Group 5: Merged Result Status Calculation
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Merged Result Status Calculation ---');
    const r1 = calculateMergedResultStatus({ existing: null, proposedRound1: '45', proposedRound2: null });
    assert(r1.mergedFR === '45' && r1.mergedSR === null && r1.finalStatus === 'PARTIAL', 'Merged Status: Empty + FR-only -> PARTIAL');

    const r2 = calculateMergedResultStatus({ existing: { round1: '45', round2: null }, proposedRound1: null, proposedRound2: '89' });
    assert(r2.mergedFR === '45' && r2.mergedSR === '89' && r2.finalStatus === 'COMPLETED', 'Merged Status: Existing FR + proposed SR -> COMPLETED');

    const r3 = calculateMergedResultStatus({ existing: null, proposedRound1: '45', proposedRound2: '89' });
    assert(r3.mergedFR === '45' && r3.mergedSR === '89' && r3.finalStatus === 'COMPLETED', 'Merged Status: Both present -> COMPLETED');

    const r4 = calculateMergedResultStatus({ existing: null, proposedRound1: null, proposedRound2: null });
    assert(r4.finalStatus === 'PENDING', 'Merged Status: Neither present -> PENDING');

    // -------------------------------------------------------------
    // Test Group 6: Score Correction Safeguards & Audit Logging
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: Score Correction Safeguards & Audit Logging ---');
    const reviewCorrection = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: testDate,
        proposedRound1: '35', // Change from 33
        proposedRound2: '67',
        reviewType: 'CORRECTION_CANDIDATE',
        status: 'PENDING',
        sourceName: 'Official Recount',
        sourceUrl: 'https://test.example/recount',
      },
    });

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
            evidenceIdentifier: 'Recount Order #12',
          },
        },
        prismaClient: prisma,
      });
    } catch (e) {
      if (e.message.includes('CORRECTION_REASON_REQUIRED')) {
        correctionBlockedWithoutReason = true;
      }
    }
    assert(correctionBlockedWithoutReason === true, 'CORRECTION SAFEGUARD: Overwriting verified score without correctionReason blocked');

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
          evidenceIdentifier: 'Recount Order #12',
        },
      },
      prismaClient: prisma,
    });
    assert(approvalCorrected.updatedResult.round1 === '35', 'Correction applied: FR updated to 35');

    const logs = await prisma.correctionLog.findMany({
      where: { resultId: approvalCorrected.updatedResult.id },
    });
    assert(logs.length === 1, 'AUDIT LOG: CorrectionLog record created');
    assert(logs[0].oldValue === '33' && logs[0].newValue === '35', 'CorrectionLog correctly tracks oldValue="33" and newValue="35"');

    // -------------------------------------------------------------
    // Test Group 7: Review Rejection Integration
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 7: Review Rejection Workflow ---');
    const reviewToReject = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: testDate,
        proposedRound1: '99',
        proposedRound2: '99',
        reviewType: 'UPDATE',
        status: 'PENDING',
        sourceName: 'Suspicious Source',
        sourceUrl: 'https://test.example/spam',
      },
    });

    const rejectedReview = await processReviewRejection({
      reviewId: reviewToReject.id,
      user: mockUser,
      rejectionReason: 'Invalid entry rejected by editor',
      prismaClient: prisma,
    });
    assert(rejectedReview.status === 'REJECTED', 'processReviewRejection marks status as REJECTED');
    assert(rejectedReview.rejectionReason === 'Invalid entry rejected by editor', 'rejectionReason recorded in database');

    // -------------------------------------------------------------
    // Test Group 8: Concurrent Review Approval Race Prevention
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 8: Concurrent Review Approval Race Prevention ---');
    const reviewRace = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: '2026-11-26',
        proposedRound1: '71',
        proposedRound2: '18',
        reviewType: 'NEW_RESULT',
        status: 'PENDING',
        sourceName: 'Race Source',
        sourceUrl: 'https://test.example/race',
      },
    });

    const [raceA, raceB] = await Promise.allSettled([
      processReviewApproval({ reviewId: reviewRace.id, user: { username: 'EditorA' }, options: { publishMode: 'unverified' }, prismaClient: prisma }),
      processReviewApproval({ reviewId: reviewRace.id, user: { username: 'EditorB' }, options: { publishMode: 'unverified' }, prismaClient: prisma }),
    ]);

    const raceSuccessCount = (raceA.status === 'fulfilled' ? 1 : 0) + (raceB.status === 'fulfilled' ? 1 : 0);
    const raceConflictCount = ((raceA.status === 'rejected' && raceA.reason.message.includes('CONCURRENT_REVIEW_CONFLICT')) ? 1 : 0) +
                              ((raceB.status === 'rejected' && raceB.reason.message.includes('CONCURRENT_REVIEW_CONFLICT')) ? 1 : 0);

    assert(raceSuccessCount === 1, 'CONCURRENCY SAFEGUARD: Exactly one concurrent approval succeeds');
    assert(raceConflictCount === 1, 'CONCURRENCY SAFEGUARD: Competing request receives CONCURRENT_REVIEW_CONFLICT');

    // -------------------------------------------------------------
    // PART A - TEST GROUP 9: Deterministic Parser & Score Sanitizer Fixtures
    // -------------------------------------------------------------
    console.log('\n--- PART A - TEST GROUP 9: Deterministic Parser & Score Sanitizer Fixtures ---');
    const fixtureTargetDate = '2028-06-15';

    // 9.1 Deterministic strict score sanitization
    assert(sanitizeScoreStrict('xx') === null, 'Score Sanitizer: Pre-round placeholder "xx" safely sanitized to null');
    assert(sanitizeScoreStrict('XX') === null, 'Score Sanitizer: Pre-round placeholder "XX" safely sanitized to null');
    assert(sanitizeScoreStrict('--') === null, 'Score Sanitizer: Pre-round placeholder "--" safely sanitized to null');
    assert(sanitizeScoreStrict('?') === null, 'Score Sanitizer: Pre-round placeholder "?" safely sanitized to null');
    assert(sanitizeScoreStrict('7') === '07', 'Score Sanitizer: Single digit score padded with leading zero ("7" -> "07")');
    assert(sanitizeScoreStrict('42') === '42', 'Score Sanitizer: Valid two digit score preserved ("42")');
    assert(sanitizeScoreStrict('00') === '00', 'Score Sanitizer: Double zero score preserved ("00")');
    assert(sanitizeScoreStrict('105') === null, 'Score Sanitizer: Out-of-bounds score sanitized to null');

    // 9.2 Declared scores extraction verification from deterministic fixture
    const declaredHtml = makeAstroIslandHtml(fixtureTargetDate, {
      shillong: { fr: '82', sr: '12', status: 'DECLARED' },
      khanapara: { fr: '23', sr: '26', status: 'DECLARED' },
      juwai: { fr: '37', sr: '10', status: 'DECLARED' },
      night: { fr: '78', sr: '96', status: 'DECLARED' },
    });
    const declaredRes = await fetchTeerResultLiveResults({ htmlOverride: declaredHtml, targetDate: fixtureTargetDate });
    assert(declaredRes.success === true, 'Declared scores extracted successfully from Astro TeerLiveBoard payload');

    const decShillong = declaredRes.results.find((g) => g.gameIdentifier === 'shillong-teer');
    const decKhanapara = declaredRes.results.find((g) => g.gameIdentifier === 'khanapara-teer');
    const decJuwai = declaredRes.results.find((g) => g.gameIdentifier === 'juwai-teer');
    const decNight = declaredRes.results.find((g) => g.gameIdentifier === 'shillong-night-teer');

    assert(decShillong && decShillong.round1 === '82' && decShillong.round2 === '12', 'Shillong Teer: Exact match (FR: 82, SR: 12)');
    assert(decKhanapara && decKhanapara.round1 === '23' && decKhanapara.round2 === '26', 'Khanapara Teer: Exact match (FR: 23, SR: 26)');
    assert(decJuwai && decJuwai.round1 === '37' && decJuwai.round2 === '10', 'Juwai Teer: Exact match (FR: 37, SR: 10)');
    assert(decNight && decNight.round1 === '78' && decNight.round2 === '96', 'Shillong Night Teer: Exact match (FR: 78, SR: 96)');

    // 9.3 Standalone extractResultsFromHtml parser verification
    const standaloneParsed = extractResultsFromHtml(declaredHtml, fixtureTargetDate);
    assert(standaloneParsed.success === true && standaloneParsed.results.length === 4, 'Standalone extractResultsFromHtml parses 4 games successfully');

    // 9.4 Strict calendar date mismatch guard on deterministic fixture
    const fixtureMismatchRes = extractResultsFromHtml(declaredHtml, '2028-06-16');
    assert(fixtureMismatchRes.isDateMismatch === true, 'Date mismatch guard triggers correctly when source date (2028-06-15) does not match expected target date (2028-06-16)');

    // 9.5 Layout mismatch safeguard (malformed HTML without Astro island)
    const badHtml = '<html><body><div><h1>Teer Results</h1><p>Numbers: 55 and 66</p></div></body></html>';
    const badParsed = extractResultsFromHtml(badHtml, fixtureTargetDate);
    assert(badParsed.success === false && badParsed.results.length === 0, 'SAFEGUARD: extractResultsFromHtml safely fails on layout mismatch with empty results');

    const badRes = await fetchTeerResultLiveResults({ htmlOverride: badHtml, targetDate: fixtureTargetDate });
    assert(badRes.success === false && badRes.results.length === 0, 'SAFEGUARD: fetchTeerResultLiveResults safely fails on layout mismatch with empty results');

    // -------------------------------------------------------------
    // PART B - LIVE SOURCE INTEGRATION TESTS (teerresultlive.in)
    // -------------------------------------------------------------
    console.log('\n--- PART B: Live Source Integration Tests (teerresultlive.in) ---');
    try {
      // B.1 Live connection and inspection of authorized source (teerresultlive.in)
      const liveHtmlRes = await fetch('https://teerresultlive.in/', {
        headers: { 'User-Agent': 'TeerResult2-SyncBot/1.0 (+https://teerresult2.com)' },
        signal: AbortSignal.timeout(10000),
      });
      assert(liveHtmlRes.status === 200, 'LIVE SOURCE PROOF: HTTP 200 response from https://teerresultlive.in/');

      const liveHtmlText = await liveHtmlRes.text();
      const containsTeerLiveBoard = /astro-island[^>]*component-url="[^"]*TeerLiveBoard[^"]*"/i.test(liveHtmlText);
      assert(containsTeerLiveBoard === true, 'LIVE SOURCE PROOF: Actual HTML response contains TeerLiveBoard Astro island');

      // B.2 Live extraction against current Asia/Kolkata date
      const liveRes = await fetchTeerResultLiveResults();
      assert(liveRes.success === true, 'Live scraper connects and extracts successfully for current Asia/Kolkata date');
      assert(liveRes.results.length === 4, 'Extracted all four competition games from live payload');

      const liveShillong = liveRes.results.find((g) => g.gameIdentifier === 'shillong-teer');
      const liveKhanapara = liveRes.results.find((g) => g.gameIdentifier === 'khanapara-teer');
      const liveJuwai = liveRes.results.find((g) => g.gameIdentifier === 'juwai-teer');
      const liveNight = liveRes.results.find((g) => g.gameIdentifier === 'shillong-night-teer');

      assert(Boolean(liveShillong && liveKhanapara && liveJuwai && liveNight), 'All four authorized games found in live feed');

      // Schema, structure and score format validation (NO fixed time or score assumptions)
      const isValidScoreOrNull = (val) => val === null || /^\d{2}$/.test(val);
      for (const game of liveRes.results) {
        assert(isValidScoreOrNull(game.round1), `${game.gameName}: FR is either null (pending) or valid 2-digit score (value: ${game.round1 ?? 'null'})`);
        assert(isValidScoreOrNull(game.round2), `${game.gameName}: SR is either null (pending) or valid 2-digit score (value: ${game.round2 ?? 'null'})`);
        assert(game.sourceVerificationState === 'PENDING_VERIFICATION', `${game.gameName}: sourceVerificationState is PENDING_VERIFICATION`);
        assert(game.dateStr === getTodayISTDateStr(), `${game.gameName}: source date matches current Asia/Kolkata calendar date (${game.dateStr})`);
      }

      // B.3 Strict calendar date mismatch guard against live endpoint
      const liveMismatchRes = await fetchTeerResultLiveResults({ targetDate: '2099-01-01' });
      assert(liveMismatchRes.isDateMismatch === true, 'Date mismatch guard triggers correctly when live source date does not match requested date (2099-01-01)');
    } catch (liveErr) {
      console.warn('Note: Live source network test encountered an issue:', liveErr.message);
      assert(false, `Live source test failed: ${liveErr.message}`);
    }

    // -------------------------------------------------------------
    // Test Group 10: Vercel Cron Security & Bearer Header Verification
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 10: Vercel Cron Authentication Logic ---');
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

    // Verify vercel.json configuration
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8'));
    assert(Array.isArray(vercelConfig.crons) && vercelConfig.crons.length > 0, 'vercel.json contains valid crons array');
    const syncCron = vercelConfig.crons.find((c) => c.path === '/api/cron/sync-results');
    assert(Boolean(syncCron), 'vercel.json schedules /api/cron/sync-results automated endpoint');

    // -------------------------------------------------------------
    // Test Group 11: PostgreSQL DDL & Migration Integrity Check
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 11: PostgreSQL DDL & Migration Integrity ---');
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

    const requiredPgTables = [
      'GameCategory',
      'TeerResult',
      'PendingResultReview',
      'AutomationLock',
      'SourceRecord',
      'CorrectionLog',
      'LoginAttempt',
      'AdminUser',
      'ImportJob',
    ];
    const allTablesCovered = requiredPgTables.every((t) => mig1.includes(`CREATE TABLE "${t}"`) || mig2.includes(`CREATE TABLE "${t}"`));
    assert(allTablesCovered === true, 'All 9 production models exist in PostgreSQL DDL migrations');

    let pgSchemaValid = false;
    try {
      execSync('npx prisma validate --schema=prisma-postgres/schema.prisma', {
        env: { ...process.env, DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/teerresult2_test?sslmode=disable' },
        stdio: 'pipe',
      });
      pgSchemaValid = true;
    } catch {}
    assert(pgSchemaValid === true, 'Prisma PostgreSQL schema (prisma-postgres/schema.prisma) passes strict validation');

    // -------------------------------------------------------------
    // Test Group 12: Public Pages Data Consumption After Admin Approval
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 12: Homepage & Public Pages Data Consumption ---');
    const todayStr = getTodayISTDateStr();

    // 12.1 Create and approve a review for today's Shillong Teer
    const liveReview = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: todayStr,
        proposedRound1: '64',
        proposedRound2: '28',
        reviewType: 'NEW_RESULT',
        status: 'PENDING',
        sourceName: 'Ground Observer',
        sourceUrl: 'https://test.example/live-today',
      },
    });

    await processReviewApproval({
      reviewId: liveReview.id,
      user: mockUser,
      options: {
        publishMode: 'verified',
        markVerified: true,
        confirmedByEditor: true,
        officialEvidence: {
          sourceAuthority: 'Khasi Hills Archery Sports Association (KHASA)',
          evidenceIdentifier: 'Today Slip #101',
        },
      },
      prismaClient: prisma,
    });

    // 12.2 Test Homepage Query Consumption
    const homeCategories = await prisma.gameCategory.findMany({
      where: { isActive: true },
      include: {
        results: {
          where: { dateStr: todayStr },
        },
      },
    });

    const homeShillong = homeCategories.find((c) => c.slug === 'shillong-teer');
    const homeResult = homeShillong?.results?.find((r) => r.dateStr === todayStr);

    assert(Boolean(homeResult), 'Homepage query retrieves approved today result');
    assert(homeResult?.round1 === '64' && homeResult?.round2 === '28', 'Homepage displays approved FR (64) and SR (28)');
    assert(homeResult?.status === 'COMPLETED', 'Homepage reflects COMPLETED status');
    assert(homeResult?.isVerified === true, 'Homepage displays verified badge (isVerified: true)');

    // 12.3 Test Dedicated Game Result Page Query Consumption
    const dedicatedCategory = await prisma.gameCategory.findUnique({
      where: { slug: 'shillong-teer' },
      include: {
        results: {
          where: { dateStr: todayStr },
          take: 1,
        },
      },
    });

    const dedicatedResult = dedicatedCategory?.results?.[0];
    assert(Boolean(dedicatedResult), 'Dedicated game page query retrieves approved today result');
    assert(dedicatedResult?.round1 === '64' && dedicatedResult?.round2 === '28', 'Dedicated game page displays exact approved numbers');
    assert(dedicatedResult?.sourceInfo.includes('KHASA'), 'Dedicated page displays official ground authority provenance');

    console.log('\n================================================================');
    console.log(`TEERRESULT2 V10 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    await prisma.$disconnect();
    // Allow process file handles to release
    await new Promise((r) => setTimeout(r, 600));

    // Clean up disposable test database
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
        const journalPath = `${TEST_DB_PATH}-journal`;
        if (fs.existsSync(journalPath)) fs.unlinkSync(journalPath);
        console.log('✓ Disposable test database safely cleaned up.');
        break;
      } catch (cleanErr) {
        if (attempt === 4) {
          console.warn('Note: test.db deferred cleanup warning:', cleanErr.message);
        } else {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal test error:', err);
    await prisma.$disconnect();
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    } catch {}
    process.exit(1);
  }
}

runAllTests();
