const fs = require('fs');
const path = require('path');

const APP_DIR = path.join(__dirname, '..', 'src', 'app');

const pages = [
  { slug: '', file: 'page.js', expectedH1: 'Teer Result Today – Shillong, Khanapara & Juwai', targetKw: 'Teer Result Today' },
  { slug: 'shillong-teer-result', file: 'shillong-teer-result/page.js', expectedH1: 'Shillong Teer Result Today', targetKw: 'Shillong Teer Result Today' },
  { slug: 'khanapara-teer-result', file: 'khanapara-teer-result/page.js', expectedH1: 'Khanapara Teer Result', targetKw: 'Khanapara Teer Result' },
  { slug: 'juwai-teer-result', file: 'juwai-teer-result/page.js', expectedH1: 'Juwai Teer Result Today', targetKw: 'Juwai Teer Result Today' },
  { slug: 'shillong-night-teer', file: 'shillong-night-teer/page.js', expectedH1: 'Shillong Night Teer Result', targetKw: 'Shillong Night Teer Result' },
  { slug: 'previous-results', file: 'previous-results/page.js', expectedH1: 'Teer Previous Results', targetKw: 'Teer Previous Results' },
  { slug: 'teer-result-history', file: 'teer-result-history/page.js', expectedH1: 'Teer Result History', targetKw: 'Teer Result History' },
  { slug: 'teer-dream-numbers', file: 'teer-dream-numbers/page.js', expectedH1: 'Teer Dream Numbers', targetKw: 'Teer Dream Numbers' },
  { slug: 'what-is-teer', file: 'what-is-teer/page.js', targetKw: 'What Is Teer' },
  { slug: 'result-verification', file: 'result-verification/page.js', targetKw: 'Result Verification' },
  { slug: 'correction-policy', file: 'correction-policy/page.js', targetKw: 'Correction Policy' },
  { slug: 'about-us', file: 'about-us/page.js', targetKw: 'About Us' },
  { slug: 'contact', file: 'contact/page.js', targetKw: 'Contact' },
  { slug: 'privacy-policy', file: 'privacy-policy/page.js', targetKw: 'Privacy Policy' },
  { slug: 'terms-and-conditions', file: 'terms-and-conditions/page.js', targetKw: 'Terms and Conditions' },
];

console.log('--- AUDITING PAGES METADATA, H1, CANONICAL & SCHEMAS ---');

for (const p of pages) {
  const filePath = path.join(APP_DIR, p.file);
  if (!fs.existsSync(filePath)) {
    console.error(`MISSING FILE: ${filePath}`);
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');

  // Check Title
  const titleMatch = content.match(/title:\s*['"`]([^'"`]+)['"`]/);
  const title = titleMatch ? titleMatch[1] : 'NONE';

  // Check Description
  const descMatch = content.match(/description:\s*['"`]([^'"`]+)['"`]/s);
  const desc = descMatch ? descMatch[1].replace(/\s+/g, ' ').slice(0, 80) : 'NONE';

  // Check Canonical
  const canonMatch = content.match(/canonical:\s*['"`]([^'"`]+)['"`]/);
  const canonical = canonMatch ? canonMatch[1] : 'NONE';

  // Check H1
  const h1Match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  let h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : 'NONE';

  // Check H1 count
  const allH1s = content.match(/<h1/g);
  const h1Count = allH1s ? allH1s.length : 0;

  // Check JSON-LD
  const hasJsonLd = content.includes('application/ld+json');

  // Check Breadcrumbs
  const hasBreadcrumbs = content.includes('<Breadcrumb');

  console.log(`\nPage: /${p.slug ? p.slug + '/' : ''}`);
  console.log(`  Title: "${title}"`);
  console.log(`  H1 (count: ${h1Count}): "${h1}"`);
  console.log(`  Canonical: ${canonical}`);
  console.log(`  Has JSON-LD: ${hasJsonLd}`);
  console.log(`  Has Breadcrumbs: ${hasBreadcrumbs}`);
}
