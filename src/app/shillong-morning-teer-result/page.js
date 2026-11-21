import prisma from '@/lib/prisma';
import { getTodayISTDateStr, formatISTDisplayDate, getDayOfWeekFromDateStr } from '@/lib/date-utils';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';
import GameQuickLinks from '@/components/GameQuickLinks';

export const revalidate = 60;

export const metadata = {
  title: 'Shillong Morning Teer Result Today – FR (10:30 AM) & SR (11:30 AM) Live | TeerResult',
  description:
    'Check Shillong Morning Teer Result Today for First Round (10:30 AM) & Second Round (11:30 AM). Accurate morning archery scores from Polo Grounds Shillong, past 30 days archive, and verified bulletins.',
  alternates: {
    canonical: 'https://teerresult24.com/shillong-morning-teer-result/',
  },
  openGraph: {
    title: 'Shillong Morning Teer Result Today – FR & SR Live Updates | TeerResult',
    description:
      'Timely verified Shillong Morning Teer results declared at 10:30 AM and 11:30 AM IST. Complete round-by-round numbers and historical archive.',
    url: 'https://teerresult24.com/shillong-morning-teer-result/',
    siteName: 'TeerResult',
    locale: 'en_IN',
    type: 'website',
  },
};

export default async function ShillongMorningTeerPage() {
  const todayStr = getTodayISTDateStr();

  let category = null;
  try {
    category = await prisma.gameCategory.findUnique({
      where: { slug: 'shillong-morning-teer' },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        round1Time: true,
        round2Time: true,
        results: {
          orderBy: { dateStr: 'desc' },
          take: 30,
          select: {
            id: true,
            dateStr: true,
            round1: true,
            round2: true,
            status: true,
            isVerified: true,
          },
        },
      },
    });
  } catch (err) {
    console.warn('[ShillongMorningTeerPage] Database unavailable:', err.message || err);
    category = {
      name: 'Shillong Morning Teer',
      slug: 'shillong-morning-teer',
      location: 'Polo Grounds, Shillong, Meghalaya',
      round1Time: '10:30 AM',
      round2Time: '11:30 AM',
      results: [],
    };
  }

  const todayResult = category?.results?.find((r) => r.dateStr === todayStr);
  const isDeclared = Boolean(todayResult?.round1 && todayResult?.round2);
  const isPartial = Boolean(todayResult?.round1 && !todayResult?.round2);
  const isVerified = Boolean(todayResult?.isVerified);

  let statusLabel = 'Awaiting Result';
  let badgeClass = 'badge-done';
  let showLiveDot = false;
  if (isDeclared && isVerified) {
    statusLabel = 'LIVE';
    badgeClass = 'badge-live';
    showLiveDot = true;
  } else if (isPartial && isVerified) {
    statusLabel = '1st Round Declared';
    badgeClass = 'badge-live';
    showLiveDot = true;
  } else if (isDeclared && !isVerified) {
    statusLabel = 'Pending Review';
    badgeClass = 'badge-done';
  } else if (isPartial && !isVerified) {
    statusLabel = 'FR Under Review';
    badgeClass = 'badge-done';
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What time is the Shillong Morning Teer result declared today?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The First Round (FR) is declared at 10:30 AM IST and the Second Round (SR) is declared at 11:30 AM IST, Monday through Saturday.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where is Shillong Morning Teer played?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Shillong Morning Teer archery matches take place at the Polo Grounds complex in Shillong, Meghalaya, conducted by licensed local traditional archery clubs.',
        },
      },
      {
        '@type': 'Question',
        name: 'How are Shillong Morning Teer numbers calculated?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Archers shoot a regulation bundle of cane arrows at a circular target. Marshals tally all arrows that hit and stick in the target; the final two digits of that count (00 to 99) form the winning round number.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does Shillong Morning Teer retain leading zeros like 04 or 09?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Official archery scorekeeping preserves two-digit formatting from 00 to 99. Single-digit hits are formatted with a leading zero (e.g., 04, 09).',
        },
      },
      {
        '@type': 'Question',
        name: 'Are Shillong Morning Teer games held on Sundays?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Traditional archery games across Meghalaya operate six days a week, Monday through Saturday. Sunday is an official rest day with no games scheduled.',
        },
      },
    ],
  };

  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <Breadcrumb items={[{ label: 'Shillong Morning Teer Result Today' }]} />

      {/* Target Keyword H1: Shillong Morning Teer Result Today */}
      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Shillong Morning Teer Result Today</h1>
        <p className="hero-subtitle">
          Early session traditional archery scores from Polo Grounds, Shillong. First Round (10:30 AM) and Second Round (11:30 AM) verified updates.
        </p>
        <div className="today-date-badge">
          <span>Date: {formatISTDisplayDate(todayStr)} (IST)</span>
        </div>
      </section>

      {/* Dedicated Shillong Morning Result Card */}
      <div className="result-card" style={{ maxWidth: '640px', margin: '0 auto 36px' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Shillong Morning Teer</div>
            <div className="card-location">Polo Grounds, Shillong, Meghalaya</div>
          </div>
          <span className={`card-badge ${badgeClass}`}>
            {showLiveDot && <span className="status-indicator-dot" aria-hidden="true" />}
            {statusLabel}
          </span>
        </div>

        <div className="rounds-row">
          <div className="round-box">
            <div className="round-label">First Round (FR)</div>
            <div className="round-time">10:30 AM IST</div>
            <div className="round-score score-accent">
              {todayResult?.round1 ?? '--'}
            </div>
            <div className="round-status">
              {todayResult?.round1
                ? todayResult.isVerified
                  ? 'Verified Score'
                  : 'Field Declaration (Pending)'
                : 'Awaiting Result'}
            </div>
          </div>

          <div className="round-box">
            <div className="round-label">Second Round (SR)</div>
            <div className="round-time">11:30 AM IST</div>
            <div className="round-score">
              {todayResult?.round2 ?? '--'}
            </div>
            <div className="round-status">
              {todayResult?.round2
                ? todayResult.isVerified
                  ? 'Verified Score'
                  : 'Field Declaration (Pending)'
                : 'Awaiting Result'}
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: '14px',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            gap: '6px',
          }}
        >
          <span>Ground: Polo Grounds Shillong</span>
          <span>Timezone: Asia/Kolkata (IST)</span>
        </div>
      </div>

      {/* 30-Day Historical Table */}
      <section style={{ marginBottom: '40px' }}>
        <div className="section-head">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Shillong Morning Teer Previous 30 Days Records
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Historical archive of morning declarations with verified two-digit numbers.
            </p>
          </div>
          <Link
            href="/previous-results/?category=shillong-morning-teer"
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            Full Archive &rarr;
          </Link>
        </div>

        <div className="table-responsive">
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>First Round (10:30 AM)</th>
                <th>Second Round (11:30 AM)</th>
                <th>Verification</th>
              </tr>
            </thead>
            <tbody>
              {category?.results && category.results.length > 0 ? (
                category.results.map((r) => {
                  const dayName = getDayOfWeekFromDateStr(r.dateStr);
                  return (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.dateStr}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{dayName}</td>
                      <td>
                        <span className="table-score score-highlight">{r.round1 ?? '--'}</span>
                      </td>
                      <td>
                        <span className="table-score">{r.round2 ?? '--'}</span>
                      </td>
                      <td>
                        <span
                          className={`card-badge ${r.isVerified ? 'badge-live' : 'badge-done'}`}
                          style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                        >
                          {r.isVerified ? 'Verified Bulletin' : 'Field Declaration'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                      No Historical Records Currently Available
                    </div>
                    <p style={{ fontSize: '0.85rem', margin: 0 }}>
                      Verified historical outcomes will appear here following official declarations.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Comprehensive Game-Specific SEO Content */}
      <article className="seo-article">
        <h2>About Shillong Morning Teer: Morning Format, Timings, and Scoring</h2>
        <p>
          <strong>Shillong Morning Teer</strong> is an early traditional archery competition held in Shillong, Meghalaya. Designed as a prelude to the afternoon sessions, this morning match brings together local archers at the Polo Grounds complex to conduct a prompt, highly structured two-round event.
        </p>
        <p>
          Like all authentic Meghalaya Teer competitions, Shillong Morning Teer is rooted in indigenous Khasi archery culture. It is conducted with hand-crafted bamboo bows and standard cane arrows under transparent field supervision.
        </p>

        <h3>Shooting Timings and Two-Round Structure</h3>
        <p>
          The morning competition operates on a precise morning schedule, giving participants and followers clear checkpoints before noon:
        </p>
        <ul>
          <li>
            <strong>First Round (FR) — 10:30 AM IST:</strong> Licensed archers shoot a designated number of cane arrows at the circular target. Once shooting ceases, target marshals collect, inspect, and bundle every valid arrow that struck the target. The last two digits of the total arrow count determine the First Round winning number (00–99).
          </li>
          <li>
            <strong>Second Round (SR) — 11:30 AM IST:</strong> Exactly one hour later, the archers line up for the final round. Following the same counting protocol, marshals tally the valid hits, and the concluding two digits form the Second Round winning number.
          </li>
        </ul>

        <h3>Preservation of Leading Zeros</h3>
        <p>
          At TeerResult, score consistency is strictly enforced. When an arrow count resolves to a single digit, it is always recorded and presented with its leading zero intact (for example, <strong>04</strong> and <strong>09</strong>, never truncated to 4 or 9). This ensures exact parity with official ground records and prevents discrepancies across historical statistics.
        </p>

        <h3>Verification and Correction Standards</h3>
        <p>
          All morning scores posted on TeerResult pass through a two-tier verification workflow: field marshal confirmation followed by editorial review. In the rare event of a counting correction or recount at Polo Grounds, our system records the adjustment in an audit log and updates the public bulletin immediately with a timestamp.
        </p>

        <h3>Frequently Asked Questions about Shillong Morning Teer</h3>
        <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              What time is the Shillong Morning Teer result declared?
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              The First Round (FR) is declared at 10:30 AM IST and the Second Round (SR) is declared at 11:30 AM IST.
            </p>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              Are morning matches held on Sundays?
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              No. Archery clubs observe Sunday as a mandatory rest day across all traditional Meghalaya formats. Matches run Monday through Saturday.
            </p>
          </div>
        </div>
      </article>

      {/* Contextual Navigation to Other Competitions & Archive */}
      <GameQuickLinks currentSlug="shillong-morning-teer" />
    </div>
  );
}
