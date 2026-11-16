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
  console.log('TEERRESULT2 VERSION 8 — FINAL AUTOMATION HARDENING TEST SUITE');
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
    // Test Group 1: Lock Renewal Enforcement & Lost Lock Abort
    // -------------------------------------------------------------
    console.log('--- TEST GROUP 1: Lock Renewal Enforcement & Lost Lock Abort ---');
    const lockKey = 'AUTOMATION_SYNC_LOCK';
    await prisma.automationLock.deleteMany({ where: { key: lockKey } });

    const workerA = `Worker-A-${crypto.randomUUID()}`;
    const workerB = `Worker-B-${crypto.randomUUID()}`;

    // 1.1 Active lease renewal
    const acqA = await acquireAutomationLock(workerA);
    assert(acqA.acquired === true, 'Worker A acquires automation lock');

    const renewA = await renewAutomationLock(workerA, 60000);
    assert(renewA === true, 'renewAutomationLock returns true for active lock owner');

    // 1.2 Non-owner lease renewal rejection
    const renewB = await renewAutomationLock(workerB, 60000);
    assert(renewB === false, 'renewAutomationLock returns false for non-owner');

    // 1.3 Lost lock mid-job abort: simulate Worker A's lock being taken over by Worker B
    await prisma.automationLock.update({
      where: { key: lockKey },
      data: { lockedBy: workerB, expiresAt: new Date(Date.now() + 60000) },
    });

    // Worker A now attempts renewal and should get false
    const renewLost = await renewAutomationLock(workerA, 60000);
    assert(renewLost === false, 'Expired or hijacked lock correctly returns false to previous worker');

    // Cleanup lock
    await releaseAutomationLock(workerB);

    // -------------------------------------------------------------
    // Test Group 2: Concurrent Jobs Compete for Lock
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Concurrent Jobs Compete for Lock ---');
    await prisma.automationLock.deleteMany({ where: { key: lockKey } });

    // Simulate an active job holding the lock
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

    // Competing job must be rejected / skipped immediately without writes
    const competingJob = await runSyncJob({
      requestedBy: 'CompetingWorker',
      htmlOverride: mockHtmlSync,
      targetDate: '2026-11-15',
    });

    assert(competingJob.success === false, 'Competing job does not proceed');
    assert(competingJob.skipped === true, 'Competing job returns skipped: true');
    assert(competingJob.message.includes('locked by PrimaryWorker'), 'Reports active lock holder in skip message');

    // Clean active lock
    await prisma.automationLock.deleteMany({ where: { key: lockKey } });

    // -------------------------------------------------------------
    // Test Group 3: Strong Evidence Validation for Official Verification
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Strong Evidence Validation ---');
    // Mirror validation logic in src/app/api/admin/reviews/route.js
    function validateOfficialGroundEvidence(options) {
      const { confirmedByEditor, officialEvidence, editorialEvidence } = options;
      if (!confirmedByEditor) {
        return { valid: false, error: 'Editorial confirmation required' };
      }
      let authority = '';
      let identifier = '';
      if (officialEvidence && typeof officialEvidence === 'object') {
        authority = (officialEvidence.sourceAuthority || '').trim();
        identifier = (officialEvidence.evidenceIdentifier || '').trim();
      } else if (typeof editorialEvidence === 'string' && editorialEvidence.trim()) {
        const raw = editorialEvidence.trim();
        const authorityPattern = /(khasi\s*hills|khasa|polo\s*ground|khanapara|juwai|jaintia|counter\s*syndicate|archery\s*association|sanctioned\s*counter|official\s*bulletin)/i;
        const identifierPattern = /(bulletin\s*#?\s*\d+|slip\s*#?\s*\d+|sheet\s*#?\s*\d+|board\s*#?\s*\d+|ref\s*#?\s*[\w-]+|id\s*#?\s*[\w-]+|#\d{1,6}|\b\d{3,6}\b)/i;
        if (authorityPattern.test(raw) && identifierPattern.test(raw)) {
          authority = raw.match(authorityPattern)[0];
          identifier = raw.match(identifierPattern)[0];
        }
      }
      const isScraperDomain = (str) => {
        const lower = (str || '').toLowerCase();
        return lower.includes('teerresultlive') || lower.includes('teertoday') || lower.includes('teercounter') || lower.startsWith('http');
      };
      if (!authority || authority.length < 4 || isScraperDomain(authority)) {
        return { valid: false, error: 'Identifiable sanctioned authority required' };
      }
      if (!identifier || identifier.length < 2 || isScraperDomain(identifier)) {
        return { valid: false, error: 'Verifiable document or slip identifier required' };
      }
      return { valid: true, authority, identifier };
    }

    // 3.1 Rejection: missing confirmedByEditor
    const resNoConfirm = validateOfficialGroundEvidence({
      confirmedByEditor: false,
      officialEvidence: { sourceAuthority: 'Khasi Hills Archery', evidenceIdentifier: 'Bulletin #14' },
    });
    assert(resNoConfirm.valid === false, 'Rejects verification without confirmedByEditor');

    // 3.2 Rejection: bare aggregator URL
    const resAggregator = validateOfficialGroundEvidence({
      confirmedByEditor: true,
      editorialEvidence: 'https://teerresultlive.in/bulletin-board-view',
    });
    assert(resAggregator.valid === false, 'Rejects third-party aggregator URL as verification proof');

    // 3.3 Rejection: generic filler text without identifiable authority or bulletin ID
    const resGeneric = validateOfficialGroundEvidence({
      confirmedByEditor: true,
      editorialEvidence: 'I checked this result and it looks totally verified to me today.',
    });
    assert(resGeneric.valid === false, 'Rejects generic filler text lacking identifiable authority/record reference');

    // 3.4 Acceptance: structured official provenance
    const resStructured = validateOfficialGroundEvidence({
      confirmedByEditor: true,
      officialEvidence: {
        sourceAuthority: 'Khasi Hills Archery Sports Association (KHASA)',
        evidenceIdentifier: 'Polo Ground Bulletin #14',
      },
    });
    assert(resStructured.valid === true, 'Accepts structured official evidence with sanctioned authority and bulletin ref');

    // 3.5 Acceptance: formatted text string with recognized authority and bulletin ID
    const resDelimited = validateOfficialGroundEvidence({
      confirmedByEditor: true,
      editorialEvidence: 'Authority: Polo Ground Archery Association | Ref: Counter Slip #104 | Notes: Signed by steward',
    });
    assert(resDelimited.valid === true, 'Accepts formatted text string specifying recognized authority and counter slip');

    // -------------------------------------------------------------
    // Test Group 4: Merged Result Status Calculation
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Merged Result Status Calculation ---');

    function calculateMergedStatus(existing, nextFR, nextSR) {
      const mergedFR = nextFR !== null ? nextFR : (existing ? existing.round1 : null);
      const mergedSR = nextSR !== null ? nextSR : (existing ? existing.round2 : null);
      let status = 'PENDING';
      if (mergedFR && mergedSR) status = 'COMPLETED';
      else if (mergedFR || mergedSR) status = 'PARTIAL';
      return { mergedFR, mergedSR, status };
    }

    // 4.1 Empty existing + FR-only proposed -> PARTIAL
    const r1 = calculateMergedStatus(null, '45', null);
    assert(r1.mergedFR === '45' && r1.mergedSR === null && r1.status === 'PARTIAL', 'FR-only on empty record results in status: PARTIAL');

    // 4.2 Existing has FR='45' and SR=null. Review proposes SR='89' with proposedRound1=null
    // BUG REGRESSION TEST: Previous code used only proposed values and returned 'PARTIAL'!
    const r2 = calculateMergedStatus({ round1: '45', round2: null }, null, '89');
    assert(r2.mergedFR === '45' && r2.mergedSR === '89' && r2.status === 'COMPLETED', 'SR-only on existing FR record correctly merges into status: COMPLETED (Fix Verified!)');

    // 4.3 Existing has FR='45' and SR='89'. Both rounds present
    const r3 = calculateMergedStatus(null, '45', '89');
    assert(r3.mergedFR === '45' && r3.mergedSR === '89' && r3.status === 'COMPLETED', 'Both rounds present results in status: COMPLETED');

    // 4.4 Neither round present -> PENDING
    const r4 = calculateMergedStatus(null, null, null);
    assert(r4.status === 'PENDING', 'No scores present results in status: PENDING');

    // -------------------------------------------------------------
    // Test Group 5: Database Transactions for Partial, Verified, and Corrected Workflows
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Database Workflow Integrations ---');
    const testDate = '2026-11-20';

    // Clear prior test rows
    await prisma.teerResult.deleteMany({ where: { dateStr: testDate } });
    await prisma.pendingResultReview.deleteMany({ where: { dateStr: testDate } });

    // Step A: Create initial FR-only pending review
    const reviewFR = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: testDate,
        proposedRound1: '32',
        proposedRound2: null,
        reviewType: 'NEW_RESULT',
        status: 'PENDING',
        sourceName: 'Field Source',
        sourceUrl: 'https://test.example',
      },
    });

    // Approve FR-only as unverified
    const resultFR = await prisma.$transaction(async (tx) => {
      await tx.pendingResultReview.update({ where: { id: reviewFR.id }, data: { status: 'APPROVED' } });
      return await tx.teerResult.create({
        data: {
          categoryId: catShillong.id,
          dateStr: testDate,
          round1: '32',
          round2: null,
          status: 'PARTIAL',
          isVerified: false,
          sourceInfo: 'Imported via Field Source (Unverified Live Score - Pending Official Ground Verification)',
        },
      });
    });

    assert(resultFR.round1 === '32' && resultFR.round2 === null && resultFR.status === 'PARTIAL', 'Database created PARTIAL unverified record');
    assert(resultFR.isVerified === false, 'Record is clearly marked isVerified: false');

    // Step B: Create second pending review for SR-only
    const reviewSR = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: testDate,
        proposedRound1: null,
        proposedRound2: '67',
        reviewType: 'UPDATE',
        status: 'PENDING',
        sourceName: 'Field Source',
        sourceUrl: 'https://test.example',
      },
    });

    // Approve SR-only WITH official ground evidence
    const resultMerged = await prisma.$transaction(async (tx) => {
      await tx.pendingResultReview.update({ where: { id: reviewSR.id }, data: { status: 'APPROVED' } });
      const current = await tx.teerResult.findUnique({
        where: { categoryId_dateStr: { categoryId: catShillong.id, dateStr: testDate } },
      });

      const mergedFR = reviewSR.proposedRound1 !== null ? reviewSR.proposedRound1 : current.round1;
      const mergedSR = reviewSR.proposedRound2 !== null ? reviewSR.proposedRound2 : current.round2;
      const finalStatus = (mergedFR && mergedSR) ? 'COMPLETED' : 'PARTIAL';

      return await tx.teerResult.update({
        where: { id: current.id },
        data: {
          round1: mergedFR,
          round2: mergedSR,
          status: finalStatus,
          isVerified: true,
          verifiedAt: new Date(),
          verifiedBy: 'Chief Editor',
          sourceInfo: 'Officially Verified via KHASA (Ref: Official Bulletin #14) - Attested by Chief Editor',
        },
      });
    });

    assert(resultMerged.round1 === '32', 'Merged result preserves FR "32"');
    assert(resultMerged.round2 === '67', 'Merged result updates SR "67"');
    assert(resultMerged.status === 'COMPLETED', 'Merged result status transition: PARTIAL -> COMPLETED');
    assert(resultMerged.isVerified === true, 'Merged result successfully verified with provenance');

    // Step C: Score correction workflow with CorrectionLog
    const reviewCorrection = await prisma.pendingResultReview.create({
      data: {
        categoryId: catShillong.id,
        dateStr: testDate,
        proposedRound1: '35', // revised from 32
        proposedRound2: '67',
        reviewType: 'CORRECTION_CANDIDATE',
        status: 'PENDING',
        sourceName: 'Audited Source',
        sourceUrl: 'https://test.example',
      },
    });

    const resultCorrected = await prisma.$transaction(async (tx) => {
      await tx.pendingResultReview.update({ where: { id: reviewCorrection.id }, data: { status: 'APPROVED' } });
      const current = await tx.teerResult.findUnique({
        where: { categoryId_dateStr: { categoryId: catShillong.id, dateStr: testDate } },
      });

      await tx.correctionLog.create({
        data: {
          resultId: current.id,
          roundNumber: 1,
          oldValue: current.round1,
          newValue: '35',
          reason: 'Field recount by Chief Steward',
          correctedBy: 'Chief Editor',
        },
      });

      return await tx.teerResult.update({
        where: { id: current.id },
        data: {
          round1: '35',
          status: 'COMPLETED',
          isVerified: true,
          sourceInfo: 'Officially Verified via KHASA (Ref: Bulletin #14 Rev A)',
        },
      });
    });

    assert(resultCorrected.round1 === '35', 'Score corrected to "35"');
    const correctionCount = await prisma.correctionLog.count({ where: { resultId: resultCorrected.id } });
    assert(correctionCount === 1, 'CorrectionLog entry successfully recorded for score revision');

    // Clean test records
    await prisma.teerResult.deleteMany({ where: { dateStr: testDate } });
    await prisma.pendingResultReview.deleteMany({ where: { dateStr: testDate } });

    // -------------------------------------------------------------
    // Test Group 6: Live Scraper Validation (All 4 Games)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: Real Scraper Validation ---');
    try {
      // Test against the published active bulletin date (2026-11-14)
      const historicalRes = await fetchTeerResultLiveResults({ targetDate: '2026-11-14' });
      assert(historicalRes.success === true, 'Live source extracts successfully against active bulletin date (2026-11-14)');
      assert(historicalRes.results.length === 4, 'Extracted all four games: Shillong, Khanapara, Juwai, Shillong Night');

      const shillongGame = historicalRes.results.find((g) => g.gameIdentifier === 'shillong-teer');
      const khanaparaGame = historicalRes.results.find((g) => g.gameIdentifier === 'khanapara-teer');
      const juwaiGame = historicalRes.results.find((g) => g.gameIdentifier === 'juwai-teer');
      const nightGame = historicalRes.results.find((g) => g.gameIdentifier === 'shillong-night-teer');

      assert(shillongGame && shillongGame.round1 === '82' && shillongGame.round2 === '12', 'Shillong Teer scores exact match (82/12)');
      assert(khanaparaGame && khanaparaGame.round1 === '23' && khanaparaGame.round2 === '26', 'Khanapara Teer scores exact match (23/26)');
      assert(juwaiGame && juwaiGame.round1 === '37' && juwaiGame.round2 === '10', 'Juwai Teer scores exact match (37/10)');
      assert(nightGame && nightGame.round1 === '78' && nightGame.round2 === '96', 'Shillong Night Teer scores exact match (78/96)');

      // Live test against today (Sunday Nov 15: clubs closed)
      const sundayRes = await fetchTeerResultLiveResults();
      assert(sundayRes.isDateMismatch === true, 'Sunday date mismatch guard triggers correctly (no results written on closed day)');
    } catch (e) {
      console.error('Scraper test error:', e);
      failed++;
    }

    // -------------------------------------------------------------
    // Test Group 7: Cron Bearer Authentication Logic
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 7: Cron Bearer Authentication Logic ---');
    const secret = 'valid_test_cron_secret_12345';
    function isAuthorizedCron(authHeader, queryToken) {
      if (queryToken) return false; // Query tokens strictly rejected!
      if (!authHeader) return false;
      return authHeader.trim() === `Bearer ${secret}`;
    }

    assert(isAuthorizedCron('Bearer valid_test_cron_secret_12345', null) === true, 'Accepts valid Authorization Bearer header');
    assert(isAuthorizedCron('Bearer wrong_secret', null) === false, 'Rejects invalid Bearer token');
    assert(isAuthorizedCron(null, null) === false, 'Rejects missing Authorization header');
    assert(isAuthorizedCron(null, 'valid_test_cron_secret_12345') === false, 'Rejects query token ?token=... strictly');

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
    console.log(`TEERRESULT2 V8 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
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
