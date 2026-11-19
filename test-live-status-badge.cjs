const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert');

console.log('================================================================');
console.log('TEERRESULT2 - "LIVE" STATUS BADGE & INDICATOR VERIFICATION SUITE');
console.log('================================================================');

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// 1. Verify CSS styles in globals.css
it('globals.css defines .status-badge and .card-badge with green #059669 theme', () => {
  const css = fs.readFileSync(path.join(__dirname, 'src/app/globals.css'), 'utf8');
  assert(css.includes('.status-badge'), 'Must contain .status-badge');
  assert(css.includes('.card-badge'), 'Must contain .card-badge');
  assert(css.includes('.status-badge.live'), 'Must contain .status-badge.live');
  assert(css.includes('.card-badge.badge-live'), 'Must contain .card-badge.badge-live');
  assert(css.includes('var(--primary-color)'), 'Must use primary-color');
  assert(css.includes('#ecfdf5'), 'Must use light green background');
  assert(css.includes('#a7f3d0'), 'Must use emerald border');
});

it('globals.css defines .status-indicator-dot', () => {
  const css = fs.readFileSync(path.join(__dirname, 'src/app/globals.css'), 'utf8');
  assert(css.includes('.status-indicator-dot'), 'Must contain .status-indicator-dot');
  assert(css.includes('border-radius: 50%'), 'Must be circular');
  assert(css.includes('background-color: var(--primary-color)'), 'Must be primary-color green');
});

it('globals.css defines .status-badge.waiting for undeclared results', () => {
  const css = fs.readFileSync(path.join(__dirname, 'src/app/globals.css'), 'utf8');
  assert(css.includes('.status-badge.waiting'), 'Must contain .status-badge.waiting');
  assert(css.includes('Awaiting Result') || css.includes('var(--text-muted)'), 'Waiting styling present');
});

// 2. Verify LiveResults.jsx
it('LiveResults.jsx renders "LIVE" for verified declared results', () => {
  const code = fs.readFileSync(path.join(__dirname, 'src/components/LiveResults.jsx'), 'utf8');
  assert(code.includes("statusText = 'LIVE'"), 'Must set statusText to LIVE');
  assert(code.includes("badgeClass = 'live'"), 'Must set badgeClass to live');
  assert(code.includes('showLiveDot = true'), 'Must enable live indicator dot');
  assert(code.includes('status-indicator-dot'), 'Must render status-indicator-dot element');
  assert(!code.includes("statusText = 'Declared'"), 'Must NOT set statusText to Declared');
  assert(code.includes("statusText = 'Awaiting Result'"), 'Must retain Awaiting Result for undeclared');
});

it('LiveResults.jsx guards unverified/pending results from showing LIVE', () => {
  const code = fs.readFileSync(path.join(__dirname, 'src/components/LiveResults.jsx'), 'utf8');
  assert(code.includes('isVerified'), 'Must check isVerified before marking LIVE');
});

// 3. Verify HomePage page.js
it('HomePage page.js sets statusLabel to "LIVE" for verified declared results', () => {
  const code = fs.readFileSync(path.join(__dirname, 'src/app/page.js'), 'utf8');
  assert(code.includes("statusLabel = 'LIVE'"), 'Must set statusLabel to LIVE');
  assert(!code.includes("if (isDeclared) statusLabel = 'Declared'"), 'Must not assign Declared to statusLabel');
  assert(code.includes("Yesterday"), 'Yesterday section preserved');
  assert(!code.includes("yesterdaySummary.map((item) => { item.statusLabel = 'LIVE'"), 'Historical results do not show LIVE');
});

// 4. Verify Individual Game Pages
const individualPages = [
  'src/app/shillong-teer-result/page.js',
  'src/app/khanapara-teer-result/page.js',
  'src/app/juwai-teer-result/page.js',
  'src/app/shillong-night-teer/page.js',
];

for (const pagePath of individualPages) {
  it(`${pagePath} displays "LIVE" with status indicator for verified results`, () => {
    const code = fs.readFileSync(path.join(__dirname, pagePath), 'utf8');
    assert(code.includes("statusLabel = 'LIVE'"), `${pagePath} must assign LIVE to statusLabel`);
    assert(code.includes("badgeClass = 'badge-live'"), `${pagePath} must use badge-live class`);
    assert(code.includes('showLiveDot = true'), `${pagePath} must set showLiveDot`);
    assert(code.includes('status-indicator-dot'), `${pagePath} must render status-indicator-dot`);
    assert(code.includes("statusLabel = 'Awaiting Result'"), `${pagePath} must keep Awaiting Result for undeclared`);
  });
}

// 5. Verify PreviousResultsTable does NOT show LIVE
it('PreviousResultsTable.jsx does NOT show "LIVE" for historical records', () => {
  const code = fs.readFileSync(path.join(__dirname, 'src/components/PreviousResultsTable.jsx'), 'utf8');
  assert(!code.includes("LIVE"), 'Historical table must not display LIVE');
  assert(code.includes('Verified Bulletin') || code.includes('Verified'), 'Historical records display Verified');
});

console.log('\n================================================================');
console.log(`STATUS BADGE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================');

if (failed > 0) {
  process.exit(1);
}
