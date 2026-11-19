/**
 * TeerResult2 — Comprehensive E2E Publishing Pipeline Test Suite
 * Validates the complete admin-to-public result publishing pipeline on an isolated database:
 * 1. Dynamic category resolution for all 4 canonical games (IDs and slugs)
 * 2. Strict separation between database query/connection failures (500) and genuinely missing categories (400)
 * 3. "Save as Pending" persists to PendingResultReview and sets isVerified: false
 * 4. "Approve & Mark Verified" securely updates TeerResult with valid evidence URL and marks pending review as APPROVED
 * 5. Public consumption queries reflect approved scores and keep unverified scores awaiting result
 * 6. Score correction safeguards & CorrectionLog audit trail
 * 7. Two-character string preservation ("00", "04", "09")
 */

const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const assert = require('node:assert');

const TEST_DB_PATH = path.join(__dirname, 'test-e2e-pipeline.db');
const TEST_DB_URL = `file:${TEST_DB_PATH}`;

process.env.DATABASE_URL = TEST_DB_URL;
process.env.NODE_ENV = 'test';
process.env.ADMIN_JWT_SECRET = 'test-secret-key-12345678901234567890';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'test_password_123';

console.log('================================================================');
console.log('TEERRESULT2 E2E RESULT PUBLISHING PIPELINE VERIFICATION');
console.log('================================================================\n');

try {
  if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
} catch {}

execSync('npx prisma generate --schema=prisma-sqlite/schema.prisma', { stdio: 'pipe' });
execSync('npx prisma migrate deploy --schema=prisma-sqlite/schema.prisma', {
  env: { ...process.env, DATABASE_URL: TEST_DB_URL },
  stdio: 'pipe',
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

let passedTests = 0;
let failedTests = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

async function asyncIt(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failedTests++;
  }
}

async function runAllTests() {
  const { recordAdminResult } = await import('./src/lib/publish-manager.js');
  const { ensureOfficialCategories, resolveCanonicalCategorySlug } = await import('./src/lib/categories.js');
  const { validateTeerNumber } = await import('./src/lib/date-utils.js');

  const adminUser = {
    id: 'usr_admin_test',
    username: 'admin',
    name: 'Chief Editor',
    role: 'ADMIN',
  };

  const testDate = '2026-11-18';

  // Seed categories
  await ensureOfficialCategories(prisma);

  // -------------------------------------------------------------
  // TEST GROUP 1: Canonical Category Resolution
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Canonical Category Resolution ---');

  await asyncIt('All 4 canonical categories exist with matching IDs and slugs in isolated DB', async () => {
    const cats = await prisma.gameCategory.findMany({ orderBy: { order: 'asc' } });
    assert.strictEqual(cats.length, 4);
    const slugs = cats.map((c) => c.slug);
    assert.deepStrictEqual(slugs, ['shillong-teer', 'khanapara-teer', 'juwai-teer', 'shillong-night-teer']);
  });

  it('Resolves slug and category variations canonically', () => {
    assert.strictEqual(resolveCanonicalCategorySlug('shillong-teer'), 'shillong-teer');
    assert.strictEqual(resolveCanonicalCategorySlug('khanapara-teer'), 'khanapara-teer');
    assert.strictEqual(resolveCanonicalCategorySlug('cat_khanapara_teer'), 'khanapara-teer');
    assert.strictEqual(resolveCanonicalCategorySlug('Khanapara Teer'), 'khanapara-teer');
    assert.strictEqual(resolveCanonicalCategorySlug('juwai-teer'), 'juwai-teer');
    assert.strictEqual(resolveCanonicalCategorySlug('shillong-night-teer'), 'shillong-night-teer');
  });

  // -------------------------------------------------------------
  // TEST GROUP 2: Error Separation (Query Error vs Missing Category)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Error Separation ---');

  await asyncIt('Rejects non-existent category with 400 and lists available categories', async () => {
    let thrownError = null;
    try {
      await recordAdminResult({
        categoryId: 'non-existent-game-xyz',
        dateStr: testDate,
        round1: '10',
        round2: '20',
        action: 'submit',
        user: adminUser,
      }, prisma);
    } catch (err) {
      thrownError = err;
    }
    assert.ok(thrownError, 'Should have thrown error for non-existent category');
    assert.strictEqual(thrownError.statusCode, 400);
    assert.ok(thrownError.message.includes('could not be found in database'));
    assert.ok(thrownError.message.includes('Available categories: [shillong-teer, khanapara-teer'));
  });

  await asyncIt('Distinguishes database query failure from category not found', async () => {
    const mockDbError = {
      gameCategory: {
        findFirst: async () => {
          const err = new Error('getaddrinfo ENOTFOUND fake-host.hyperdrive.local');
          err.code = 'ENOTFOUND';
          throw err;
        },
      },
    };

    let thrownError = null;
    try {
      await recordAdminResult({
        categoryId: 'shillong-teer',
        dateStr: testDate,
        round1: '10',
        round2: '20',
        action: 'submit',
        user: adminUser,
      }, mockDbError);
    } catch (err) {
      thrownError = err;
    }
    assert.ok(thrownError, 'Should throw on database failure');
    assert.strictEqual(thrownError.statusCode, 500, 'Database failure must return HTTP 500');
    assert.ok(thrownError.message.includes('Database error resolving category'), 'Must report database error, NOT category not found');
  });

  // -------------------------------------------------------------
  // TEST GROUP 3: "Save as Pending" Draft Review Workflow
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Save as Pending Workflow ---');

  await asyncIt('Save as Pending creates record in PendingResultReview with PENDING status', async () => {
    const outcome = await recordAdminResult({
      categoryId: 'khanapara-teer',
      dateStr: testDate,
      round1: '04',
      round2: '09',
      sourceInfo: 'Official Field Record',
      sourceEvidenceUrl: 'https://example.com/draft-bulletin',
      action: 'submit', // Draft / preliminary mode
      user: adminUser,
    }, prisma);

    assert.strictEqual(outcome.success, true);
    assert.strictEqual(outcome.published, false, 'Draft mode must not mark as published');
    assert.strictEqual(outcome.result.isVerified, false, 'Result must be marked isVerified: false');
    assert.strictEqual(outcome.result.verifiedAt, null, 'verifiedAt must be null for draft');

    const pendingInDb = await prisma.pendingResultReview.findFirst({
      where: {
        categoryId: 'khanapara-teer',
        dateStr: testDate,
        status: 'PENDING',
      },
    });
    assert.ok(pendingInDb, 'Pending review must exist in PendingResultReview table');
    assert.strictEqual(pendingInDb.proposedRound1, '04');
    assert.strictEqual(pendingInDb.proposedRound2, '09');
  });

  await asyncIt('Public consumer query returns Awaiting Result while record is pending verification', async () => {
    const categoriesWithResults = await prisma.gameCategory.findMany({
      where: { slug: 'khanapara-teer' },
      include: {
        results: {
          where: { dateStr: testDate },
        },
      },
    });

    const game = categoriesWithResults[0];
    const res = game.results[0] || null;
    // Public display logic: Only verified results are declared
    const isPubliclyDeclared = Boolean(res?.isVerified && res?.round1 && res?.round2);
    assert.strictEqual(isPubliclyDeclared, false, 'Unverified draft numbers must not be declared publicly');
  });

  // -------------------------------------------------------------
  // TEST GROUP 4: "Approve & Mark Verified" Workflow
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Approve & Mark Verified Workflow ---');

  await asyncIt('Rejects official verification when source evidence URL is missing', async () => {
    let thrownError = null;
    try {
      await recordAdminResult({
        categoryId: 'khanapara-teer',
        dateStr: testDate,
        round1: '04',
        round2: '09',
        sourceInfo: 'Official Field Record',
        sourceEvidenceUrl: '', // Missing
        action: 'approve_and_verify',
        user: adminUser,
      }, prisma);
    } catch (err) {
      thrownError = err;
    }
    assert.ok(thrownError, 'Should reject verification without evidence URL');
    assert.strictEqual(thrownError.statusCode, 400);
    assert.ok(thrownError.message.includes('requires a valid source evidence URL'));
  });

  await asyncIt('Rejects invalid evidence URL syntax', async () => {
    let thrownError = null;
    try {
      await recordAdminResult({
        categoryId: 'khanapara-teer',
        dateStr: testDate,
        round1: '04',
        round2: '09',
        sourceEvidenceUrl: 'not-a-valid-url',
        action: 'approve_and_verify',
        user: adminUser,
      }, prisma);
    } catch (err) {
      thrownError = err;
    }
    assert.ok(thrownError);
    assert.strictEqual(thrownError.statusCode, 400);
  });

  await asyncIt('Approve & Mark Verified successfully writes to TeerResult with valid evidence', async () => {
    const outcome = await recordAdminResult({
      categoryId: 'khanapara-teer',
      dateStr: testDate,
      round1: '04',
      round2: '09',
      sourceInfo: 'Polo Grounds Official Draw',
      sourceEvidenceUrl: 'https://example.com/official-bulletin-42',
      action: 'approve_and_verify',
      user: adminUser,
    }, prisma);

    assert.strictEqual(outcome.success, true);
    assert.strictEqual(outcome.published, true);
    assert.strictEqual(outcome.result.round1, '04');
    assert.strictEqual(outcome.result.round2, '09');
    assert.strictEqual(outcome.result.isVerified, true);
    assert.strictEqual(outcome.result.verifiedBy, 'Chief Editor');
    assert.strictEqual(outcome.result.status, 'COMPLETED');
    assert.strictEqual(outcome.result.sourceEvidenceUrl, 'https://example.com/official-bulletin-42');
  });

  await asyncIt('Approve action automatically marks matching pending reviews as APPROVED', async () => {
    const pendingReviews = await prisma.pendingResultReview.findMany({
      where: {
        categoryId: 'khanapara-teer',
        dateStr: testDate,
      },
    });

    assert.ok(pendingReviews.length > 0);
    for (const rev of pendingReviews) {
      assert.strictEqual(rev.status, 'APPROVED', 'Pending reviews must be updated to APPROVED');
    }
  });

  await asyncIt('Public consumer query now reflects verified declared scores', async () => {
    const categoriesWithResults = await prisma.gameCategory.findMany({
      where: { slug: 'khanapara-teer' },
      include: {
        results: {
          where: { dateStr: testDate },
        },
      },
    });

    const game = categoriesWithResults[0];
    const res = game.results[0];
    assert.ok(res, 'Record must exist in public results');
    assert.strictEqual(res.round1, '04');
    assert.strictEqual(res.round2, '09');
    assert.strictEqual(res.isVerified, true);
    assert.strictEqual(Boolean(res.isVerified && res.round1 && res.round2), true, 'Scores are officially declared');
  });

  // -------------------------------------------------------------
  // TEST GROUP 5: Leading Zeros and Two-Character String Preservation
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Two-Character String Preservation ---');

  it('validateTeerNumber preserves "00", "04", "09", "99"', () => {
    assert.deepStrictEqual(validateTeerNumber('00'), { isValid: true, value: '00' });
    assert.deepStrictEqual(validateTeerNumber('04'), { isValid: true, value: '04' });
    assert.deepStrictEqual(validateTeerNumber('09'), { isValid: true, value: '09' });
    assert.deepStrictEqual(validateTeerNumber('99'), { isValid: true, value: '99' });
    assert.strictEqual(validateTeerNumber('4').isValid, false);
    assert.strictEqual(validateTeerNumber('100').isValid, false);
  });

  await asyncIt('Publishes double zero "00" score preserving string format in database', async () => {
    const outcome = await recordAdminResult({
      categoryId: 'shillong-teer',
      dateStr: testDate,
      round1: '00',
      round2: '04',
      sourceEvidenceUrl: 'https://example.com/bulletin-shillong',
      action: 'approve_and_verify',
      user: adminUser,
    }, prisma);

    assert.strictEqual(outcome.result.round1, '00');
    assert.strictEqual(typeof outcome.result.round1, 'string');
    assert.strictEqual(outcome.result.round2, '04');
    assert.strictEqual(typeof outcome.result.round2, 'string');
  });

  // -------------------------------------------------------------
  // TEST GROUP 6: Correction Safeguards & Audit Logging
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Score Correction Safeguards ---');

  await asyncIt('Revising an already verified score without correctionReason is BLOCKED', async () => {
    let thrownError = null;
    try {
      await recordAdminResult({
        categoryId: 'khanapara-teer',
        dateStr: testDate,
        round1: '35', // Changing from '04' to '35'
        round2: '09',
        sourceEvidenceUrl: 'https://example.com/revised-bulletin',
        action: 'approve_and_verify',
        correctionReason: '', // Missing
        user: adminUser,
      }, prisma);
    } catch (err) {
      thrownError = err;
    }
    assert.ok(thrownError, 'Should block revision without reason');
    assert.strictEqual(thrownError.statusCode, 400);
    assert.ok(thrownError.message.includes('correction reason'));
  });

  await asyncIt('Revising with valid correctionReason creates CorrectionLog audit record', async () => {
    const outcome = await recordAdminResult({
      categoryId: 'khanapara-teer',
      dateStr: testDate,
      round1: '35',
      round2: '09',
      sourceEvidenceUrl: 'https://example.com/revised-bulletin',
      action: 'approve_and_verify',
      correctionReason: 'Official recount adjustment by judge board',
      user: adminUser,
    }, prisma);

    assert.strictEqual(outcome.success, true);
    assert.strictEqual(outcome.result.round1, '35');

    // Verify audit log entry
    const correctionLogs = await prisma.correctionLog.findMany({
      where: { resultId: outcome.result.id },
    });

    assert.ok(correctionLogs.length > 0, 'Must create CorrectionLog record');
    const log = correctionLogs[0];
    assert.strictEqual(log.roundNumber, 1);
    assert.strictEqual(log.oldValue, '04');
    assert.strictEqual(log.newValue, '35');
    assert.strictEqual(log.reason, 'Official recount adjustment by judge board');
  });

  // -------------------------------------------------------------
  // TEST GROUP 7: All 4 Canonical Games Verification
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Verification Across All 4 Canonical Games ---');

  const games = ['shillong-teer', 'khanapara-teer', 'juwai-teer', 'shillong-night-teer'];
  for (const gameSlug of games) {
    await asyncIt(`Successfully saves and verifies result for "${gameSlug}"`, async () => {
      const outcome = await recordAdminResult({
        categoryId: gameSlug,
        dateStr: testDate,
        round1: '12',
        round2: '34',
        sourceEvidenceUrl: `https://example.com/bulletin-${gameSlug}`,
        action: 'approve_and_verify',
        correctionReason: 'Routine daily declaration',
        user: adminUser,
      }, prisma);

      assert.strictEqual(outcome.success, true);
      assert.strictEqual(outcome.result.round1, '12');
      assert.strictEqual(outcome.result.round2, '34');
      assert.strictEqual(outcome.result.isVerified, true);
    });
  }

  // Teardown
  await prisma.$disconnect();
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  } catch {}

  console.log('\n================================================================');
  console.log(`E2E PIPELINE TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
