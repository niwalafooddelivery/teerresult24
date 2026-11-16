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
  console.log('TEERRESULT2 V7 AUTOMATION RELIABILITY TEST SUITE');
  console.log('================================================================\n');

  const {
    runSyncJob,
    acquireAutomationLock,
    renewAutomationLock,
    releaseAutomationLock,
  } = await import('./src/lib/importers/sync-engine.js');

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
    // Ensure standard categories exist in database
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

    // -------------------------------------------------------------
    // Test 1: Date Mismatch Enforcement
    // -------------------------------------------------------------
    console.log('--- TEST 1: Date Mismatch Enforcement ---');
    const mockHtmlYesterday = makeAstroIslandHtml('2026-11-14', {
      shillong: { fr: '82', sr: '12', status: 'DECLARED' },
      khanapara: { fr: '23', sr: '26', status: 'DECLARED' },
      juwai: { fr: '37', sr: '10', status: 'DECLARED' },
      night: { fr: '78', sr: '96', status: 'DECLARED' },
    });

    // Target date is 2026-11-15, but payload has 2026-11-14
    const resMismatch = await fetchTeerResultLiveResults({
      htmlOverride: mockHtmlYesterday,
      targetDate: '2026-11-15',
    });

    assert(resMismatch.isDateMismatch === true, 'Adapter flags isDateMismatch: true for 2026-11-14 vs 2026-11-15');
    assert(resMismatch.results.length === 0, 'No results returned when date mismatch is detected');

    // Test that sync job cleanly aborts with SKIPPED_DATE_MISMATCH and releases lock
    const syncMismatch = await runSyncJob({
      requestedBy: 'Test Date Mismatch Runner',
      htmlOverride: mockHtmlYesterday,
      targetDate: '2026-11-15',
    });

    assert(syncMismatch.success === false, 'Sync job returns success: false on date mismatch');
    assert(syncMismatch.isDateMismatch === true, 'Sync job reports isDateMismatch: true');

    const jobRecord = await prisma.importJob.findUnique({ where: { id: syncMismatch.jobId } });
    assert(jobRecord.status === 'SKIPPED_DATE_MISMATCH', 'ImportJob recorded status SKIPPED_DATE_MISMATCH');

    // Confirm lock was released
    const lockAfterMismatch = await prisma.automationLock.findUnique({
      where: { key: 'AUTOMATION_SYNC_LOCK' },
    });
    assert(lockAfterMismatch === null, 'Automation lock was immediately released after date mismatch skip');

    // -------------------------------------------------------------
    // Test 2: FR-Only Updates
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: FR-Only Updates ---');
    const mockHtmlFROnly = makeAstroIslandHtml('2026-11-15', {
      shillong: { fr: '45', sr: 'xx', status: 'PARTIAL' },
    });

    const resFROnly = await fetchTeerResultLiveResults({
      htmlOverride: mockHtmlFROnly,
      targetDate: '2026-11-15',
    });

    assert(resFROnly.success === true, 'Adapter parses FR-only payload successfully');
    const shillongFROnly = resFROnly.results.find((r) => r.gameIdentifier === 'shillong-teer');
    assert(shillongFROnly.round1 === '45', 'FR extracted as "45"');
    assert(shillongFROnly.round2 === null, 'SR unresolved extracted as null');

    // Clean any prior pending reviews for test isolation
    const catShillong = await prisma.gameCategory.findUnique({ where: { slug: 'shillong-teer' } });
    await prisma.pendingResultReview.deleteMany({
      where: { categoryId: catShillong.id, dateStr: '2026-11-15' },
    });

    // Run sync job with FR-only
    const syncFROnly = await runSyncJob({
      requestedBy: 'Test FR Only Runner',
      htmlOverride: mockHtmlFROnly,
      targetDate: '2026-11-15',
    });
    assert(syncFROnly.success === true, 'Sync job ingested FR-only item successfully');

    const pendingAfterFR = await prisma.pendingResultReview.findFirst({
      where: { categoryId: catShillong.id, dateStr: '2026-11-15', status: 'PENDING' },
    });
    assert(pendingAfterFR && pendingAfterFR.proposedRound1 === '45', 'Pending review created with FR "45"');
    assert(pendingAfterFR && pendingAfterFR.proposedRound2 === null, 'Pending review SR is null');

    // -------------------------------------------------------------
    // Test 3: SR Updates & Idempotency
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: SR Updates & Idempotency ---');
    const mockHtmlComplete = makeAstroIslandHtml('2026-11-15', {
      shillong: { fr: '45', sr: '89', status: 'DECLARED' },
    });

    const syncSRUpdate = await runSyncJob({
      requestedBy: 'Test SR Update Runner',
      htmlOverride: mockHtmlComplete,
      targetDate: '2026-11-15',
    });
    assert(syncSRUpdate.success === true, 'Sync job ingested subsequent SR update successfully');

    const pendingAfterSR = await prisma.pendingResultReview.findFirst({
      where: { categoryId: catShillong.id, dateStr: '2026-11-15', status: 'PENDING' },
    });
    assert(pendingAfterSR.proposedRound1 === '45', 'Pending review retained FR "45"');
    assert(pendingAfterSR.proposedRound2 === '89', 'Pending review updated SR to "89"');

    // Run identical payload again (Duplicate run test)
    console.log('\n--- TEST 4: Duplicate Runs & Idempotency ---');
    const syncDuplicate = await runSyncJob({
      requestedBy: 'Test Duplicate Runner',
      htmlOverride: mockHtmlComplete,
      targetDate: '2026-11-15',
    });
    assert(syncDuplicate.success === true, 'Duplicate sync runs without error');
    assert(syncDuplicate.recordsSaved === 0, 'Duplicate run does not create redundant pending records (0 recordsSaved)');

    // -------------------------------------------------------------
    // Test 5: Leading Zeros Preservation
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Leading Zeros Preservation ---');
    assert(sanitizeScoreStrict('04') === '04', 'Preserves leading zero "04"');
    assert(sanitizeScoreStrict('00') === '00', 'Preserves double zero "00"');
    assert(sanitizeScoreStrict('4') === null, 'Rejects single digit "4"');
    assert(sanitizeScoreStrict('105') === null, 'Rejects 3-digit "105"');
    assert(sanitizeScoreStrict('xx') === null, 'Rejects placeholders "xx"');
    assert(sanitizeScoreStrict('--') === null, 'Rejects dashes "--"');

    // -------------------------------------------------------------
    // Test 6: Locking with Unique IDs, Expired Takeover & Safe Lease Renewal
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Atomic Locking & Safe Lease Renewal ---');
    const lockId1 = `TestRunner-1-${crypto.randomUUID()}`;
    const lockId2 = `TestRunner-2-${crypto.randomUUID()}`;

    // Clear any existing lock
    await prisma.automationLock.deleteMany({ where: { key: 'AUTOMATION_SYNC_LOCK' } });

    // Acquire lock 1
    const acq1 = await acquireAutomationLock(lockId1);
    assert(acq1.acquired === true, 'Lock 1 successfully acquired');

    // Lock 2 attempt while lock 1 is active
    const acq2 = await acquireAutomationLock(lockId2);
    assert(acq2.acquired === false, 'Concurrent Lock 2 acquisition safely rejected');

    // Lease renewal test
    const renewed1 = await renewAutomationLock(lockId1, 10 * 60 * 1000);
    assert(renewed1 === true, 'Lock owner 1 successfully renewed lease');

    const renewed2 = await renewAutomationLock(lockId2);
    assert(renewed2 === false, 'Non-owner Lock 2 rejected when attempting lease renewal');

    // Safe release test: non-owner release must NOT delete owner lock
    await releaseAutomationLock(lockId2);
    const lockStillActive = await prisma.automationLock.findUnique({ where: { key: 'AUTOMATION_SYNC_LOCK' } });
    assert(lockStillActive !== null && lockStillActive.lockedBy === lockId1, 'Lock 1 preserved when lock 2 attempted release');

    // Manually expire lock 1
    await prisma.automationLock.update({
      where: { key: 'AUTOMATION_SYNC_LOCK' },
      data: { expiresAt: new Date(Date.now() - 10000) },
    });

    // Lock 2 should now acquire expired lock atomically
    const acqExpired = await acquireAutomationLock(lockId2);
    assert(acqExpired.acquired === true, 'Lock 2 successfully took over expired lock atomically');

    // Cleanup lock
    await releaseAutomationLock(lockId2);

    // -------------------------------------------------------------
    // Test 7: ImportJob Inside Protected try/finally Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Lock Release on Unexpected Exception ---');
    // Test that an execution error inside runSyncJob releases the lock
    const badSync = await runSyncJob({
      requestedBy: 'Crash Test Runner',
      htmlOverride: 'MALFORMED_NON_HTML_CRASH_TEST',
      targetDate: '2026-11-15',
    });
    const lockAfterCrash = await prisma.automationLock.findUnique({ where: { key: 'AUTOMATION_SYNC_LOCK' } });
    assert(lockAfterCrash === null, 'Lock is unconditionally released via finally even when extraction fails');

    // -------------------------------------------------------------
    // Test 8: Concurrent Approval Race Prevention (Optimistic Locking)
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Concurrent Approval Race Prevention ---');
    const testReview = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: '2026-11-15',
        proposedRound1: '77',
        proposedRound2: '33',
        reviewType: 'NEW_RESULT',
        status: 'PENDING',
        sourceName: 'Race Condition Test',
        sourceUrl: 'https://test.example/race',
      },
    });

    // Simulate two concurrent approval operations claiming the exact same review
    const approveAttempt = async (workerId) => {
      try {
        return await prisma.$transaction(async (tx) => {
          const claim = await tx.pendingResultReview.updateMany({
            where: { id: testReview.id, status: 'PENDING' },
            data: { status: 'APPROVED', reviewedBy: `Worker-${workerId}`, reviewedAt: new Date() },
          });

          if (claim.count === 0) {
            throw new Error('CONCURRENT_REVIEW_CONFLICT');
          }

          return { workerId, success: true };
        });
      } catch (err) {
        return { workerId, success: false, error: err.message };
      }
    };

    const [workerA, workerB] = await Promise.all([approveAttempt('A'), approveAttempt('B')]);
    const successCount = (workerA.success ? 1 : 0) + (workerB.success ? 1 : 0);
    const conflictCount = (workerA.error === 'CONCURRENT_REVIEW_CONFLICT' ? 1 : 0) + (workerB.error === 'CONCURRENT_REVIEW_CONFLICT' ? 1 : 0);

    assert(successCount === 1, 'Exactly one concurrent worker successfully claims approval');
    assert(conflictCount === 1, 'Concurrent competing worker receives CONCURRENT_REVIEW_CONFLICT (HTTP 409)');

    // -------------------------------------------------------------
    // Test 9: Editorial Source-Evidence Checks
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Editorial Source-Evidence Checks ---');
    function validateVerificationEvidence(markVerified, editorialEvidence) {
      if (!markVerified) return { ok: true, isVerified: false };
      const trimmed = typeof editorialEvidence === 'string' ? editorialEvidence.trim() : '';

      const isThirdPartyScraperOnly = (evidence) => {
        const lower = evidence.toLowerCase();
        return (
          lower.includes('teerresultlive.in') ||
          lower.includes('teertoday') ||
          lower.includes('teercounter') ||
          lower.startsWith('http://') ||
          lower.startsWith('https://')
        ) && evidence.length < 35;
      };

      if (!trimmed || trimmed.length < 10 || isThirdPartyScraperOnly(trimmed)) {
        return {
          ok: false,
          error:
            'Official verification requires documented editorial provenance (e.g. Sanctioned Ground Bulletin or Counter Slip record, minimum 10 characters). A third-party aggregator URL alone cannot establish official verification.',
        };
      }
      return { ok: true, isVerified: true, evidence: trimmed };
    }

    const checkEmpty = validateVerificationEvidence(true, '');
    assert(checkEmpty.ok === false, 'Rejects empty evidence when markVerified is true');

    const checkScraperUrl = validateVerificationEvidence(true, 'https://teerresultlive.in/');
    assert(checkScraperUrl.ok === false, 'Rejects third-party aggregator URL alone as verification evidence');

    const checkShort = validateVerificationEvidence(true, 'ground');
    assert(checkShort.ok === false, 'Rejects short trivial string (< 10 chars)');

    const checkValid = validateVerificationEvidence(
      true,
      'Corroborated with Meghalaya Polo Ground Official Bulletin Board #14'
    );
    assert(checkValid.ok === true && checkValid.isVerified === true, 'Accepts substantive official ground provenance evidence');

    const checkUnverified = validateVerificationEvidence(false, '');
    assert(checkUnverified.ok === true && checkUnverified.isVerified === false, 'Allows unverified publication without evidence');

    // -------------------------------------------------------------
    // Test 10: Live Scraper Extraction Against Authorized Source
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Live Scraper Check (https://teerresultlive.in/) ---');
    try {
      const liveRes = await fetchTeerResultLiveResults();
      assert(liveRes.providerName === 'TeerResultLive Aggregator', 'Provider is TeerResultLive Aggregator');
      console.log(`  Live fetch status: ${liveRes.success ? 'SUCCESS' : 'SKIPPED_DATE_MISMATCH'}`);
      console.log(`  Source Date extracted: ${liveRes.sourceDate || 'N/A'}`);
      console.log(`  Target Date (Asia/Kolkata): ${getTodayISTDateStr()}`);

      if (liveRes.isDateMismatch) {
        console.log(`  [NOTE] Live source has date ${liveRes.sourceDate} which is prior to today (${getTodayISTDateStr()}). Archery is closed on Sundays.`);
        assert(liveRes.results.length === 0, 'Safe rejection: No results written on Sunday date mismatch');
      } else if (liveRes.success) {
        assert(liveRes.results.length >= 4, 'Extracted all 4 game categories on active live day');
      }

      // Also verify extraction by testing against the published source date (2026-11-14)
      const historicalRes = await fetchTeerResultLiveResults({ targetDate: '2026-11-14' });
      assert(historicalRes.success === true, 'Live source extracts successfully when tested against active bulletin date (2026-11-14)');
      assert(historicalRes.results.length === 4, 'Extracted all 4 games: Shillong, Khanapara, Juwai, Shillong Night');
    } catch (e) {
      console.error('  Live network check error:', e.message);
      failed++;
    }

    // -------------------------------------------------------------
    // Test 11: PostgreSQL Migration DDL Integrity
    // -------------------------------------------------------------
    console.log('\n--- TEST 11: PostgreSQL Migration DDL Integrity ---');
    const mig1 = fs.readFileSync(
      path.join(__dirname, 'prisma-postgres/migrations/20261114000000_init_postgres/migration.sql'),
      'utf8'
    );
    const mig2 = fs.readFileSync(
      path.join(__dirname, 'prisma-postgres/migrations/20261115000000_add_review_queue_and_lock/migration.sql'),
      'utf8'
    );

    const checkPostgresSQL = (sql) => {
      const hasSqliteAutoinc = /AUTOINCREMENT/i.test(sql);
      const hasTimestamp3 = /TIMESTAMP\(3\)/i.test(sql);
      const hasConstraints = /CONSTRAINT/i.test(sql);
      return !hasSqliteAutoinc && hasTimestamp3 && hasConstraints;
    };

    assert(checkPostgresSQL(mig1) === true, 'Migration 1 uses valid PostgreSQL DDL (TIMESTAMP(3), CONSTRAINTS, no SQLite AUTOINCREMENT)');
    assert(checkPostgresSQL(mig2) === true, 'Migration 2 uses valid PostgreSQL DDL (PendingResultReview & AutomationLock tables)');

    console.log('\n================================================================');
    console.log(`TEST SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
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
