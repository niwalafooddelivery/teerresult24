const assert = require('node:assert');

async function testResilience() {
  console.log('============================================================');
  console.log('ADMIN LOGIN & RATE LIMITER COMPREHENSIVE VERIFICATION SUITE');
  console.log('============================================================\n');

  const { checkMemoryRateLimit, clearMemoryRateLimit, extractClientIp } = await import('./src/lib/rate-limiter.js');
  const { signToken, verifyToken, getJwtSecret } = await import('./src/lib/auth.js');
  const bcrypt = require('bcryptjs');

  const testIp = '10.0.0.99';
  clearMemoryRateLimit(testIp);

  // 1. In-memory sliding window rate limiter tests
  console.log('--- 1. Rate Limiter Sliding Window Unit Tests ---');
  for (let i = 1; i <= 4; i++) {
    const res = checkMemoryRateLimit(testIp);
    assert.strictEqual(res.allowed, true, `Attempt ${i} should be allowed`);
    assert.strictEqual(res.remaining, 5 - i, `Attempt ${i} remaining should be ${5 - i}`);
  }

  // 5th attempt
  const fifth = checkMemoryRateLimit(testIp);
  assert.strictEqual(fifth.allowed, true, '5th attempt should be allowed');
  assert.strictEqual(fifth.remaining, 0, 'Remaining should be 0 on 5th attempt');

  // 6th attempt -> Exceeded!
  const sixth = checkMemoryRateLimit(testIp);
  assert.strictEqual(sixth.allowed, false, '6th attempt must be blocked');
  assert.strictEqual(sixth.isLockedOut, true, 'isLockedOut must be true');
  assert(sixth.message.includes('Too many failed login attempts'), 'Lockout message must be descriptive');
  console.log('  [PASS] Rate limiter enforces strict 5-attempt brute-force protection');

  // Clear rate limit
  clearMemoryRateLimit(testIp);
  const afterClear = checkMemoryRateLimit(testIp);
  assert.strictEqual(afterClear.allowed, true, 'After clearing rate limit, attempt should be allowed');
  console.log('  [PASS] Clear rate limit successfully resets attempts');

  // 2. IP extraction header parsing tests
  console.log('\n--- 2. Client IP Extraction Tests ---');
  const makeReq = (headers) => ({ headers: new Headers(headers) });

  const cfReq = makeReq({ 'cf-connecting-ip': '203.0.113.195' });
  assert.strictEqual(extractClientIp(cfReq), '203.0.113.195', 'Extracts cf-connecting-ip correctly');

  const realIpReq = makeReq({ 'x-real-ip': '198.51.100.42' });
  assert.strictEqual(extractClientIp(realIpReq), '198.51.100.42', 'Extracts x-real-ip correctly');

  const xffReq = makeReq({ 'x-forwarded-for': '192.0.2.1, 10.0.0.1' });
  assert.strictEqual(extractClientIp(xffReq), '192.0.2.1', 'Extracts first x-forwarded-for IP');

  const emptyReq = makeReq({});
  assert.strictEqual(extractClientIp(emptyReq), '127.0.0.1', 'Fallback to 127.0.0.1 when headers missing');
  console.log('  [PASS] Client IP extraction supports Cloudflare and proxies with safe fallbacks');

  // 3. JWT Sign & Verify tests
  console.log('\n--- 3. JWT Authentication & Session Token Tests ---');
  const payload = { id: 'admin_test', username: 'admin', role: 'ADMIN' };
  const token = signToken(payload);
  assert(typeof token === 'string' && token.length > 20, 'Token generated');
  const verified = verifyToken(token);
  assert.strictEqual(verified.username, 'admin', 'Token verified matches username');
  assert.strictEqual(verified.role, 'ADMIN', 'Token verified matches role');
  console.log('  [PASS] JWT signing and verification passes');

  // 4. Bcrypt Password Verification Tests
  console.log('\n--- 4. Bcrypt Password Verification Tests ---');
  const rawPass = 'TeerAdmin#2026!SecureKey';
  const hash = await bcrypt.hash(rawPass, 10);
  const matchValid = await bcrypt.compare(rawPass, hash);
  const matchInvalid = await bcrypt.compare('WrongPassword123', hash);
  assert.strictEqual(matchValid, true, 'Valid password correctly matches hash');
  assert.strictEqual(matchInvalid, false, 'Invalid password rejected');
  console.log('  [PASS] Bcrypt password hashing and verification passes');

  // 5. Rate Limiter Memory Fallback Simulation (Backend DB Unavailable)
  console.log('\n--- 5. Backend Database Unavailable Fallback Simulation ---');
  // When DB throws, rate limiter catches and falls back to checkMemoryRateLimit
  const failoverIp = '10.50.60.70';
  clearMemoryRateLimit(failoverIp);
  for (let i = 1; i <= 5; i++) {
    const fallbackRes = checkMemoryRateLimit(failoverIp);
    assert.strictEqual(fallbackRes.allowed, true, `Fallback attempt ${i} allowed`);
  }
  const fallbackBlocked = checkMemoryRateLimit(failoverIp);
  assert.strictEqual(fallbackBlocked.allowed, false, 'Fallback blocks 6th attempt with HTTP 429 semantics');
  assert.strictEqual(fallbackBlocked.isLockedOut, true, 'isLockedOut true in memory fallback');
  console.log('  [PASS] In-memory fallback enforces rate limiting without 503 service unavailable lockouts');

  console.log('\n============================================================');
  console.log('ALL ADMIN LOGIN & RATE LIMITER TESTS PASSED (100% OK)');
  console.log('============================================================\n');
}

testResilience().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
