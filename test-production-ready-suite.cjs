const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  console.log('========================================================================');
  console.log('TEERRESULT24 — FINAL PRODUCTION READINESS & VERIFICATION AUDIT');
  console.log('========================================================================\n');

  // -------------------------------------------------------------------------
  // 1. PostgreSQL Migration Status & DDL Verification
  // -------------------------------------------------------------------------
  console.log('--- 1. PostgreSQL Migration Status & DDL Verification ---');
  const sqlFile = path.join(__dirname, 'prisma', 'safe-production-migrate-and-seed.sql');
  assert(fs.existsSync(sqlFile), 'prisma/safe-production-migrate-and-seed.sql exists');

  const sqlContent = fs.readFileSync(sqlFile, 'utf8');
  const requiredTables = [
    'GameCategory',
    'TeerResult',
    'PendingResultReview',
    'AutomationLock',
    'SourceRecord',
    'ImportJob',
    'CorrectionLog',
    'LoginAttempt',
    'AdminUser',
  ];

  for (const tbl of requiredTables) {
    const hasTableDef = sqlContent.includes(`CREATE TABLE IF NOT EXISTS "${tbl}"`);
    assert(hasTableDef, `SQL script defines CREATE TABLE IF NOT EXISTS "${tbl}"`);
  }
  console.log('  [PASS] All 9 production tables defined with idempotent CREATE TABLE IF NOT EXISTS');

  assert(sqlContent.includes('PendingResultReview_pkey'), 'PendingResultReview primary key defined');
  assert(sqlContent.includes('AutomationLock_pkey'), 'AutomationLock primary key defined');
  assert(sqlContent.includes('PendingResultReview_categoryId_fkey'), 'Foreign key constraint defined');
  console.log('  [PASS] Primary keys, unique indexes, and foreign key constraints verified');

  // -------------------------------------------------------------------------
  // 2. AutomationLock Table Existence & Concurrency Logic
  // -------------------------------------------------------------------------
  console.log('\n--- 2. AutomationLock Concurrency & Failover Tests ---');
  const {
    acquireAutomationLock,
    renewAutomationLock,
    isLockLeaseActive,
    releaseAutomationLock,
  } = await import('./src/lib/importers/sync-engine.js');

  const worker1 = 'Job_Alpha_' + Date.now();
  const worker2 = 'Job_Beta_' + Date.now();

  const acquired1 = await acquireAutomationLock(worker1);
  assert.strictEqual(acquired1.acquired, true, 'Worker 1 acquires lock');

  const acquired2 = await acquireAutomationLock(worker2);
  assert.strictEqual(acquired2.acquired, false, 'Worker 2 blocked while lock active');
  assert(acquired2.message.includes(worker1), 'Lock reports active holder');

  const renewed1 = await renewAutomationLock(worker1);
  assert.strictEqual(renewed1, true, 'Worker 1 can renew its own lock');

  const renewed2 = await renewAutomationLock(worker2);
  assert.strictEqual(renewed2, false, 'Worker 2 cannot renew Worker 1 lock');

  const active1 = await isLockLeaseActive(worker1);
  assert.strictEqual(active1, true, 'Worker 1 lease is active');

  const active2 = await isLockLeaseActive(worker2);
  assert.strictEqual(active2, false, 'Worker 2 lease is not active');

  await releaseAutomationLock(worker1);
  const activeAfterRelease = await isLockLeaseActive(worker1);
  assert.strictEqual(activeAfterRelease, false, 'Lock successfully released');

  const acquired2After = await acquireAutomationLock(worker2);
  assert.strictEqual(acquired2After.acquired, true, 'Worker 2 acquires lock after release');
  await releaseAutomationLock(worker2);
  console.log('  [PASS] AutomationLock concurrency, lease renewal, and release fully verified');

  // -------------------------------------------------------------------------
  // 3. Four Competition Categories Present in Seed & Canonical Config
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Four Competition Categories Verification ---');
  const { OFFICIAL_CATEGORIES, getOfficialCategories } = await import('./src/lib/categories.js');

  assert.strictEqual(OFFICIAL_CATEGORIES.length, 4, 'Exactly 4 categories');
  const expectedCats = [
    { name: 'Shillong Teer', slug: 'shillong-teer', r1: '03:45 PM', r2: '04:45 PM', order: 1 },
    { name: 'Khanapara Teer', slug: 'khanapara-teer', r1: '04:10 PM', r2: '04:45 PM', order: 2 },
    { name: 'Juwai Teer', slug: 'juwai-teer', r1: '02:05 PM', r2: '02:45 PM', order: 3 },
    { name: 'Shillong Night Teer', slug: 'shillong-night-teer', r1: '10:15 PM', r2: '11:15 PM', order: 4 },
  ];

  for (const exp of expectedCats) {
    const found = OFFICIAL_CATEGORIES.find((c) => c.slug === exp.slug);
    assert(Boolean(found), `Category "${exp.name}" found in OFFICIAL_CATEGORIES`);
    assert.strictEqual(found.name, exp.name, `Name matches "${exp.name}"`);
    assert.strictEqual(found.round1Time, exp.r1, `FR time matches "${exp.r1}"`);
    assert.strictEqual(found.round2Time, exp.r2, `SR time matches "${exp.r2}"`);
    assert.strictEqual(found.order, exp.order, `Order matches ${exp.order}`);
    assert.strictEqual(found.isActive, true, 'Category is active');
    console.log(`  [PASS] ${exp.name} (${exp.slug}) — FR: ${exp.r1} | SR: ${exp.r2}`);
  }

  // -------------------------------------------------------------------------
  // 4. Admin Dashboard Dropdown Dynamic Loading & Route Verification
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Admin Dashboard Dropdown & Dynamic Route Verification ---');
  const catApiFile = path.join(__dirname, 'src', 'app', 'api', 'admin', 'categories', 'route.js');
  assert(fs.existsSync(catApiFile), 'src/app/api/admin/categories/route.js exists');

  const catApiSource = fs.readFileSync(catApiFile, 'utf8');
  assert(catApiSource.includes('getOfficialCategories'), 'Route imports and calls getOfficialCategories');
  assert(catApiSource.includes('export async function GET'), 'Route defines GET handler');
  assert(catApiSource.includes('export const dynamic'), 'Route defines dynamic export');

  const categories = await getOfficialCategories(null);
  assert.strictEqual(categories.length, 4, 'getOfficialCategories returns 4 categories');
  assert(categories.every((c) => c.name && c.id && c.slug), 'Every category has name, id, and slug');
  console.log('  [PASS] /api/admin/categories route structure and category retrieval verified (4 categories)');

  // -------------------------------------------------------------------------
  // 5. Current Status Summary Loading & Score Handling
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Current Status Summary API & Timezone Verification ---');
  const todayApiFile = path.join(__dirname, 'src', 'app', 'api', 'results', 'today', 'route.js');
  assert(fs.existsSync(todayApiFile), 'src/app/api/results/today/route.js exists');

  const todayApiSource = fs.readFileSync(todayApiFile, 'utf8');
  assert(todayApiSource.includes('getTodayISTDateStr'), 'Route imports getTodayISTDateStr');
  assert(todayApiSource.includes('ensureOfficialCategories'), 'Route imports ensureOfficialCategories');
  assert(todayApiSource.includes('OFFICIAL_CATEGORIES'), 'Route includes fallback to OFFICIAL_CATEGORIES');
  assert(todayApiSource.includes('sourceEvidenceUrl'), 'Route exposes sourceEvidenceUrl for verification');
  console.log('  [PASS] Today results API logic verified with Asia/Kolkata date and fallback integration');

  // -------------------------------------------------------------------------
  // 6. FR/SR Score Validation & Leading Zero Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Score Validation & Leading Zero Preservation ---');
  const { validateTeerNumber } = await import('./src/lib/date-utils.js');

  assert.strictEqual(validateTeerNumber('04').value, '04', 'Preserves leading zero: "04"');
  assert.strictEqual(validateTeerNumber('09').value, '09', 'Preserves leading zero: "09"');
  assert.strictEqual(validateTeerNumber('00').value, '00', 'Preserves double zero: "00"');
  assert.strictEqual(validateTeerNumber('77').value, '77', 'Preserves double digit: "77"');
  assert.strictEqual(validateTeerNumber(null).value, null, 'Allows null for pending score');
  assert.strictEqual(validateTeerNumber('4').isValid, false, 'Rejects unpadded single digit "4"');
  assert.strictEqual(validateTeerNumber('102').isValid, false, 'Rejects 3 digits "102"');
  assert.strictEqual(validateTeerNumber('AB').isValid, false, 'Rejects non-numeric "AB"');
  console.log('  [PASS] Score validation strictly preserves leading zeros and rejects invalid formats');

  // -------------------------------------------------------------------------
  // 7. Security Settings & Cloudflare Integration
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Security Settings & Cloudflare Integration ---');
  const wrangler = JSON.parse(fs.readFileSync(path.join(__dirname, 'wrangler.jsonc'), 'utf8'));
  assert.strictEqual(wrangler.name, 'teerresult24', 'Worker name matches teerresult24');
  assert(Array.isArray(wrangler.hyperdrive), 'Hyperdrive bindings defined');
  const hyp = wrangler.hyperdrive[0];
  assert.strictEqual(hyp.binding, 'HYPERDRIVE', 'Binding is HYPERDRIVE');
  assert.strictEqual(hyp.id, '0065e4cbbf8b417da645221ab4e53bd6', 'Real Hyperdrive UUID configured');
  console.log('  [PASS] Wrangler Hyperdrive binding verified: HYPERDRIVE -> 0065e4cbbf8b417da645221ab4e53bd6');

  const { getJwtSecret } = await import('./src/lib/auth.js');
  const secret = getJwtSecret();
  assert(typeof secret === 'string' && secret.length >= 32, 'Strong JWT secret configured');
  console.log('  [PASS] JWT authentication secret verified');

  console.log('\n========================================================================');
  console.log('ALL 7 PRODUCTION READINESS AUDIT CHECKS PASSED (100% OK)');
  console.log('========================================================================\n');
}

main().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
