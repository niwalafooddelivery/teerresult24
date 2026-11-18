/**
 * TeerResult2 — Admin Publish & Result Recording Resilience Test Suite
 * Tests admin publish service, leading-zero preservation, category resolution,
 * verification workflows, and database error handling on an isolated test database.
 */

const path = require('node:path');
const fs = require('node:fs');
const { execSync } = require('node:child_process');

const TEST_DB_PATH = path.join(__dirname, 'test.db');
const TEST_DB_URL = `file:${TEST_DB_PATH}`;
process.env.DATABASE_URL = TEST_DB_URL;
process.env.ADMIN_JWT_SECRET = 'test-secret-key-12345678901234567890';
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'test_password_123';

console.log('--- Initializing Isolated Test Database ---');
try {
  execSync('npx prisma generate --schema=prisma-sqlite/schema.prisma', { stdio: 'pipe' });
  execSync('npx prisma migrate deploy --schema=prisma-sqlite/schema.prisma', {
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'pipe',
  });
  console.log('✓ Isolated test database prepared with schema.\n');
} catch (err) {
  console.error('Prisma setup failed:', err.message);
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: TEST_DB_URL } },
});

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  console.log('================================================================');
  console.log('TEERRESULT2 ADMIN PUBLISH & RESULT RECORDING RESILIENCE TESTS');
  console.log('================================================================\n');

  const { validateTeerNumber, getTodayISTDateStr } = await import('./src/lib/date-utils.js');
  const { ensureOfficialCategories, resolveCanonicalCategorySlug, OFFICIAL_CATEGORIES } = await import('./src/lib/categories.js');
  const { recordAdminResult, isValidEvidenceUrl } = await import('./src/lib/publish-manager.js');

  const adminUser = { id: 'admin1', username: 'admin', name: 'Chief Editor', role: 'ADMIN' };
  const todayStr = getTodayISTDateStr();

  // TEST 1: Authentication enforcement
  console.log('Test Suite 1: Authentication & Authorization');
  {
    try {
      await recordAdminResult({ categoryId: 'shillong-teer', round1: '04', user: null }, prisma);
      assert(false, 'Should throw error when user is null');
    } catch (err) {
      assert(err.statusCode === 401, 'Rejects unauthenticated call with 401 statusCode');
    }

    try {
      await recordAdminResult({ categoryId: 'shillong-teer', round1: '04', user: {} }, prisma);
      assert(false, 'Should throw error when user object is empty');
    } catch (err) {
      assert(err.statusCode === 401, 'Rejects empty user credentials with 401');
    }
  }

  // TEST 2: Strict Teer Number Validation & Leading Zeros
  console.log('\nTest Suite 2: Strict Teer Number Validation & Leading Zeros');
  {
    assert(validateTeerNumber('04').isValid === true && validateTeerNumber('04').value === '04', 'Preserves leading zero for "04"');
    assert(validateTeerNumber('00').isValid === true && validateTeerNumber('00').value === '00', 'Preserves double zero for "00"');
    assert(validateTeerNumber('99').isValid === true && validateTeerNumber('99').value === '99', 'Accepts "99"');
    assert(validateTeerNumber(null).isValid === true && validateTeerNumber(null).value === null, 'Accepts null for awaiting round');
    assert(validateTeerNumber('4').isValid === false, 'Rejects single digit "4" (must be 2 digits "04")');
    assert(validateTeerNumber('105').isValid === false, 'Rejects 3 digits "105"');
    assert(validateTeerNumber('XX').isValid === false, 'Rejects non-numeric string "XX"');

    try {
      await recordAdminResult({ categoryId: 'shillong-teer', round1: '105', dateStr: '2026-11-18', user: adminUser }, prisma);
      assert(false, 'Should reject 3-digit score');
    } catch (err) {
      assert(err.statusCode === 400 && err.message.includes('Round 1'), 'Throws 400 for invalid score');
    }
  }

  // TEST 3: Dynamic Category Resolution (cat_ prefix, slugs, names, auto-seeding)
  console.log('\nTest Suite 3: Dynamic Category Resolution & Auto-seeding');
  {
    // Clean categories to test dynamic auto-seed
    await prisma.teerResult.deleteMany({});
    await prisma.gameCategory.deleteMany({});
    const catsBefore = await prisma.gameCategory.count();
    assert(catsBefore === 0, 'Database categories wiped for auto-seed test');

    // Call recordAdminResult with slug 'shillong-teer' - auto-seeds 4 official categories
    const resAutoSeed = await recordAdminResult({
      categoryId: 'shillong-teer',
      dateStr: '2026-11-18',
      round1: '04',
      round2: '09',
      action: 'submit',
      user: adminUser,
    }, prisma);
    assert(resAutoSeed.success === true, 'Auto-seeds categories on demand and records result');

    const catsAfter = await prisma.gameCategory.count();
    assert(catsAfter === 4, `All 4 official categories auto-seeded into database (count: ${catsAfter})`);

    // TEST RESOLUTION OF "cat_khanapara_teer" (User's reported production issue)
    const resKhanaparaLegacy = await recordAdminResult({
      categoryId: 'cat_khanapara_teer',
      dateStr: '2026-11-18',
      round1: '10',
      round2: '20',
      action: 'submit',
      user: adminUser,
    }, prisma);
    assert(resKhanaparaLegacy.success === true, 'Resolves "cat_khanapara_teer" and records result successfully');
    assert(resKhanaparaLegacy.result.category.slug === 'khanapara-teer', 'Correctly linked to Khanapara Teer slug in database');

    // TEST RESOLUTION OF "cat_shillong_teer"
    const resShillongLegacy = await recordAdminResult({
      categoryId: 'cat_shillong_teer',
      dateStr: '2026-11-18',
      round1: '45',
      round2: '55',
      action: 'submit',
      user: adminUser,
    }, prisma);
    assert(resShillongLegacy.success === true, 'Resolves "cat_shillong_teer" successfully');

    // TEST RESOLUTION OF "cat_juwai_teer"
    const resJuwaiLegacy = await recordAdminResult({
      categoryId: 'cat_juwai_teer',
      dateStr: '2026-11-18',
      round1: '12',
      round2: '34',
      action: 'submit',
      user: adminUser,
    }, prisma);
    assert(resJuwaiLegacy.success === true, 'Resolves "cat_juwai_teer" successfully');

    // TEST RESOLUTION OF "cat_shillong_night_teer"
    const resNightLegacy = await recordAdminResult({
      categoryId: 'cat_shillong_night_teer',
      dateStr: '2026-11-18',
      round1: '78',
      round2: '90',
      action: 'submit',
      user: adminUser,
    }, prisma);
    assert(resNightLegacy.success === true, 'Resolves "cat_shillong_night_teer" successfully');

    // Category resolution by ID
    const juwaiCat = await prisma.gameCategory.findUnique({ where: { slug: 'juwai-teer' } });
    const resById = await recordAdminResult({
      categoryId: juwaiCat.id,
      dateStr: '2026-11-18',
      round1: '32',
      round2: '88',
      action: 'submit',
      user: adminUser,
    }, prisma);
    assert(resById.success === true, 'Resolves category by database ID');

    // Category resolution by Name
    const resByName = await recordAdminResult({
      categoryId: 'Khanapara Teer',
      dateStr: '2026-11-18',
      round1: '71',
      round2: null,
      action: 'submit',
      user: adminUser,
    }, prisma);
    assert(resByName.success === true, 'Resolves category by human-readable Name');

    // Rejection of unknown category
    try {
      await recordAdminResult({
        categoryId: 'non-existent-teer-game-999',
        dateStr: '2026-11-18',
        round1: '12',
        user: adminUser,
      }, prisma);
      assert(false, 'Should reject unknown category');
    } catch (err) {
      assert(err.statusCode === 400 && (err.message.includes('could not be found') || err.message.includes('could not be resolved')), 'Throws 400 for unknown category with clear diagnostic');
    }
  }

  // TEST 4: Leading Zero Persistence in Database Storage & Retrieval
  console.log('\nTest Suite 4: Database Leading Zero Persistence & Retrieval');
  {
    const testDate = '2026-11-19';
    await recordAdminResult({
      categoryId: 'shillong-teer',
      dateStr: testDate,
      round1: '04',
      round2: '09',
      action: 'submit',
      user: adminUser,
    }, prisma);

    const shillongCat = await prisma.gameCategory.findUnique({ where: { slug: 'shillong-teer' } });
    const fetched = await prisma.teerResult.findUnique({
      where: {
        categoryId_dateStr: {
          categoryId: shillongCat.id,
          dateStr: testDate,
        },
      },
    });

    assert(fetched !== null, 'Saved record successfully retrieved from database');
    assert(fetched.round1 === '04', `Round 1 strictly preserved leading zero ("04" === "${fetched.round1}")`);
    assert(fetched.round2 === '09', `Round 2 strictly preserved leading zero ("09" === "${fetched.round2}")`);
    assert(typeof fetched.round1 === 'string', 'Round 1 stored as String, not Number');
    assert(typeof fetched.round2 === 'string', 'Round 2 stored as String, not Number');
  }

  // TEST 5: Verification Workflows & Evidence URL Validation across all categories
  console.log('\nTest Suite 5: Verification Mode & Evidence Provenance');
  {
    const verifyDate = '2026-11-20';

    // 1. Submit mode (Draft / Pending)
    const resPending = await recordAdminResult({
      categoryId: 'shillong-teer',
      dateStr: verifyDate,
      round1: '55',
      round2: '66',
      action: 'submit',
      user: adminUser,
    }, prisma);
    assert(resPending.success === true, 'Draft submission succeeds');
    assert(resPending.result.isVerified === false, 'Pending result is marked isVerified: false');
    assert(resPending.result.verifiedAt === null, 'verifiedAt is null for draft submission');

    // 2. Approve mode without URL -> Must fail
    try {
      await recordAdminResult({
        categoryId: 'shillong-teer',
        dateStr: verifyDate,
        round1: '55',
        round2: '66',
        action: 'approve_and_verify',
        sourceEvidenceUrl: '',
        user: adminUser,
      }, prisma);
      assert(false, 'Should reject approval without URL');
    } catch (err) {
      assert(err.statusCode === 400 && err.message.includes('valid source evidence URL'), 'Rejects official verification without evidence URL');
    }

    // 3. Approve mode with invalid URL -> Must fail
    try {
      await recordAdminResult({
        categoryId: 'shillong-teer',
        dateStr: verifyDate,
        round1: '55',
        round2: '66',
        action: 'approve_and_verify',
        sourceEvidenceUrl: 'not-a-valid-http-url',
        user: adminUser,
      }, prisma);
      assert(false, 'Should reject approval with invalid URL');
    } catch (err) {
      assert(err.statusCode === 400 && err.message.includes('valid source evidence URL'), 'Rejects invalid evidence URL');
    }

    // 4. Approve mode with valid URL -> Must succeed
    const resApproved = await recordAdminResult({
      categoryId: 'shillong-teer',
      dateStr: verifyDate,
      round1: '55',
      round2: '66',
      action: 'approve_and_verify',
      sourceEvidenceUrl: 'https://example.com/khasi-archery-bulletin-20',
      sourceInfo: 'Polo Grounds Official Draw #20',
      user: adminUser,
    }, prisma);
    assert(resApproved.success === true, 'Verification with valid URL succeeds');
    assert(resApproved.result.isVerified === true, 'Approved result is marked isVerified: true');
    assert(Boolean(resApproved.result.verifiedAt), 'verifiedAt timestamp recorded');
    assert(resApproved.result.verifiedBy === 'Chief Editor' || resApproved.result.verifiedBy === 'admin', 'verifiedBy recorded with admin username/name');
    assert(resApproved.result.sourceEvidenceUrl === 'https://example.com/khasi-archery-bulletin-20', 'sourceEvidenceUrl recorded');

    // 5. If score is revised with action: 'submit', previous verification must be REVOKED
    const resRevised = await recordAdminResult({
      categoryId: 'shillong-teer',
      dateStr: verifyDate,
      round1: '58', // Score changed from 55 to 58
      round2: '66',
      action: 'submit',
      correctionReason: 'Recount audit correction',
      user: adminUser,
    }, prisma);
    assert(resRevised.success === true, 'Score revision succeeds');
    assert(resRevised.result.isVerified === false, 'Verification is automatically REVOKED when score is revised without renewed approval');
    assert(resRevised.result.status === 'CORRECTED', 'Status marked as CORRECTED when score is updated');
  }

  // TEST 6: Atomic Upsert Idempotency
  console.log('\nTest Suite 6: Atomic Upsert Idempotency');
  {
    const idempDate = '2026-11-21';
    // Run 3 rapid consecutive upserts on same category and date
    const r1 = await recordAdminResult({ categoryId: 'juwai-teer', dateStr: idempDate, round1: '11', round2: '22', action: 'submit', user: adminUser }, prisma);
    const r2 = await recordAdminResult({ categoryId: 'juwai-teer', dateStr: idempDate, round1: '11', round2: '23', action: 'submit', user: adminUser }, prisma);
    const r3 = await recordAdminResult({ categoryId: 'juwai-teer', dateStr: idempDate, round1: '11', round2: '24', action: 'submit', user: adminUser }, prisma);

    assert(r1.success === true && r2.success === true && r3.success === true, 'All consecutive upserts succeed without conflict');

    const juwaiCat = await prisma.gameCategory.findUnique({ where: { slug: 'juwai-teer' } });
    const countRecords = await prisma.teerResult.count({
      where: {
        categoryId: juwaiCat.id,
        dateStr: idempDate,
      },
    });
    assert(countRecords === 1, 'Exactly one atomic record exists in database (no duplicates)');

    const finalRecord = await prisma.teerResult.findUnique({
      where: {
        categoryId_dateStr: {
          categoryId: juwaiCat.id,
          dateStr: idempDate,
        },
      },
    });
    assert(finalRecord.round2 === '24', `Final upserted value is recorded ("${finalRecord.round2}" === "24")`);
  }

  // Clean up test database records
  await prisma.teerResult.deleteMany({});
  await prisma.$disconnect();

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
