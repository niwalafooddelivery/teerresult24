const assert = require('node:assert');

async function testDashboardSuite() {
  console.log('================================================================');
  console.log('TEST SUITE: CATEGORIES, AUTOMATION LOCK & DASHBOARD RESILIENCE');
  console.log('================================================================\n');

  // 1. Categories Definition and Fallback Verification
  console.log('--- 1. Official Competition Categories Verification ---');
  const { OFFICIAL_CATEGORIES, getOfficialCategories } = await import('./src/lib/categories.js');

  assert.strictEqual(OFFICIAL_CATEGORIES.length, 4, 'Exactly 4 official competition categories defined');

  const names = OFFICIAL_CATEGORIES.map((c) => c.name);
  assert(names.includes('Shillong Teer'), 'Contains Shillong Teer');
  assert(names.includes('Khanapara Teer'), 'Contains Khanapara Teer');
  assert(names.includes('Juwai Teer'), 'Contains Juwai Teer');
  assert(names.includes('Shillong Night Teer'), 'Contains Shillong Night Teer');

  const slugs = OFFICIAL_CATEGORIES.map((c) => c.slug);
  assert(slugs.includes('shillong-teer'), 'Contains slug shillong-teer');
  assert(slugs.includes('khanapara-teer'), 'Contains slug khanapara-teer');
  assert(slugs.includes('juwai-teer'), 'Contains slug juwai-teer');
  assert(slugs.includes('shillong-night-teer'), 'Contains slug shillong-night-teer');

  for (const cat of OFFICIAL_CATEGORIES) {
    assert(typeof cat.round1Time === 'string' && cat.round1Time.length > 0, `${cat.name} has round1Time`);
    assert(typeof cat.round2Time === 'string' && cat.round2Time.length > 0, `${cat.name} has round2Time`);
    assert.strictEqual(cat.isActive, true, `${cat.name} is marked active`);
  }
  console.log('  [PASS] All 4 canonical competition categories verified with schedule times and slugs.');

  // 2. Fallback when DB client is empty or null
  const catsFromNull = await getOfficialCategories(null);
  assert.strictEqual(catsFromNull.length, 4, 'getOfficialCategories safely returns 4 categories when DB is null');
  console.log('  [PASS] getOfficialCategories gracefully falls back when database client is null or offline.');

  // 3. AutomationLock In-Memory Fallback Verification
  console.log('\n--- 2. Automation Lock Fallback Verification ---');
  const {
    acquireAutomationLock,
    renewAutomationLock,
    isLockLeaseActive,
    releaseAutomationLock,
  } = await import('./src/lib/importers/sync-engine.js');

  const workerId1 = 'TestWorker_Alpha_123';
  const workerId2 = 'TestWorker_Beta_456';

  // Acquire lock
  const lock1 = await acquireAutomationLock(workerId1);
  assert.strictEqual(lock1.acquired, true, 'Worker Alpha successfully acquired lock');

  // Competing acquisition must be rejected
  const lock2 = await acquireAutomationLock(workerId2);
  assert.strictEqual(lock2.acquired, false, 'Worker Beta acquisition rejected while lock is active');
  assert(lock2.message.includes('locked by TestWorker_Alpha_123'), 'Rejection message reports active lock holder');
  console.log('  [PASS] Competing process blocked by active lock.');

  // Renew lock
  const renewed = await renewAutomationLock(workerId1);
  assert.strictEqual(renewed, true, 'Worker Alpha renewed active lease');

  // Stale worker cannot renew
  const staleRenew = await renewAutomationLock(workerId2);
  assert.strictEqual(staleRenew, false, 'Stale worker cannot renew another process lease');
  console.log('  [PASS] Lease renewal strictly enforces ownership.');

  // Check active lease
  const isActiveAlpha = await isLockLeaseActive(workerId1);
  const isActiveBeta = await isLockLeaseActive(workerId2);
  assert.strictEqual(isActiveAlpha, true, 'Worker Alpha has active lease');
  assert.strictEqual(isActiveBeta, false, 'Worker Beta has no active lease');
  console.log('  [PASS] Active lease check correctly verifies holder.');

  // Release lock
  await releaseAutomationLock(workerId1);
  const releasedLease = await isLockLeaseActive(workerId1);
  assert.strictEqual(releasedLease, false, 'Lock is released');

  // Now Worker Beta can acquire
  const lockBeta = await acquireAutomationLock(workerId2);
  assert.strictEqual(lockBeta.acquired, true, 'Worker Beta acquired lock after release');
  await releaseAutomationLock(workerId2);
  console.log('  [PASS] Lock release allows subsequent acquisition.');

  // 4. Teer Score Validation & Leading Zero Preservation
  console.log('\n--- 3. Teer Score Validation & Leading Zero Preservation ---');
  const { validateTeerNumber } = await import('./src/lib/date-utils.js');

  const valid04 = validateTeerNumber('04');
  assert.strictEqual(valid04.isValid, true, '04 is valid');
  assert.strictEqual(valid04.value, '04', 'Leading zero preserved for 04');

  const valid09 = validateTeerNumber('09');
  assert.strictEqual(valid09.isValid, true, '09 is valid');
  assert.strictEqual(valid09.value, '09', 'Leading zero preserved for 09');

  const valid00 = validateTeerNumber('00');
  assert.strictEqual(valid00.isValid, true, '00 is valid');
  assert.strictEqual(valid00.value, '00', '00 preserved');

  const valid99 = validateTeerNumber('99');
  assert.strictEqual(valid99.isValid, true, '99 is valid');
  assert.strictEqual(valid99.value, '99', '99 preserved');

  const emptyNull = validateTeerNumber(null);
  assert.strictEqual(emptyNull.isValid, true, 'null is valid');
  assert.strictEqual(emptyNull.value, null, 'null returns null');

  const invalidLetter = validateTeerNumber('4A');
  assert.strictEqual(invalidLetter.isValid, false, 'Alphanumeric rejected');

  const invalidThree = validateTeerNumber('105');
  assert.strictEqual(invalidThree.isValid, false, 'Three digits rejected');

  const invalidSingle = validateTeerNumber('7');
  assert.strictEqual(invalidSingle.isValid, false, 'Unpadded single digit rejected');
  console.log('  [PASS] Strict 2-digit format validation preserves leading zeros (04, 09, 00).');

  // 5. Asia/Kolkata Date Formatting
  console.log('\n--- 4. Asia/Kolkata Date Utilities ---');
  const { getTodayISTDateStr, isValidCalendarDate } = await import('./src/lib/date-utils.js');
  const todayIST = getTodayISTDateStr();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(todayIST), 'Returns valid YYYY-MM-DD date string');
  assert(isValidCalendarDate(todayIST), 'Date is a legitimate calendar date');
  console.log(`  [PASS] getTodayISTDateStr returns valid IST date: ${todayIST}`);

  console.log('\n================================================================');
  console.log('ALL DASHBOARD, CATEGORIES & LOCK TESTS PASSED (100% OK)');
  console.log('================================================================\n');
}

testDashboardSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
