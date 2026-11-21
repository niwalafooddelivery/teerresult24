import prisma from '@/lib/prisma';
import { getTodayISTDateStr, formatISTDisplayDate, getDayOfWeekFromDateStr } from '@/lib/date-utils';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';
import GameQuickLinks from '@/components/GameQuickLinks';

export const revalidate = 60;

export const metadata = {
  title: 'Welcome Morning Teer Result Today – FR (10:30 AM) & SR (11:30 AM) Live | TeerResult',
  description:
    'Check Welcome Morning Teer Result Today for First Round (10:30 AM) & Second Round (11:30 AM). Prompt morning traditional archery scores, past 30 days archive, and verified bulletins on TeerResult.',
  alternates: {
    canonical: 'https://teerresult24.com/welcome-morning-teer-result/',
  },
  openGraph: {
    title: 'Welcome Morning Teer Result Today – FR & SR Live Updates | TeerResult',
    description:
      'Timely verified Welcome Morning Teer results declared at 10:30 AM and 11:30 AM IST. Complete round numbers and 30-day historical archive.',
    url: 'https://teerresult24.com/welcome-morning-teer-result/',
    siteName: 'TeerResult',
    locale: 'en_IN',
    type: 'website',
  },
};

export default async function WelcomeMorningTeerPage() {
  const todayStr = getTodayISTDateStr();

  let category = null;
  try {
    category = await prisma.gameCategory.findUnique({
      where: { slug: 'welcome-morning-teer' },
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
    console.warn('[WelcomeMorningTeerPage] Database unavailable:', err.message || err);
    category = {
      name: 'Welcome Morning Teer',
      slug: 'welcome-morning-teer',
      location: 'Meghalaya / Khanapara Border',
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
        name: 'What time is the Welcome Morning Teer result announced today?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The First Round (FR) is declared at 10:30 AM IST and the Second Round (SR) is declared at 11:30 AM IST, Monday through Saturday.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where does the Welcome Morning Teer competition take place?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Matches take place in the border region of Meghalaya and Khanapara, conducted by licensed archery clubs using authentic target shooting regulations.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is the winning number determined in Welcome Morning Teer?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Archers shoot traditional cane arrows into a standardized target. Marshals count all valid embedded arrows, and the last two digits (00 to 99) form the round outcome.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does Welcome Morning Teer preserve two-digit formatting for single digits?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Scores between 0 and 9 are recorded with a leading zero (e.g., 04, 09) to preserve standardized 00–99 data integrity.',
        },
      },
      {
        '@type': 'Question',
        name: 'Are Welcome Morning Teer events scheduled on Sundays?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Authentic traditional archery events are held six days a week from Monday to Saturday. Sunday is observed as a rest day.',
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

      <Breadcrumb items={[{ label: 'Welcome Morning Teer Result Today' }]} />

      {/* Target Keyword H1: Welcome Morning Teer Result Today */}
      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Welcome Morning Teer Result Today</h1>
        <p className="hero-subtitle">
          Early morning archery outcomes from the Meghalaya / Khanapara region. First Round (10:30 AM) and Second Round (11:30 AM) verified updates.
        </p>
        <div className="today-date-badge">
          <span>Date: {formatISTDisplayDate(todayStr)} (IST)</span>
        </div>
      </section>

      {/* Dedicated Welcome Morning Result Card */}
      <div className="result-card" style={{ maxWidth: '640px', margin: '0 auto 36px' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Welcome Morning Teer</div>
            <div className="card-location">Meghalaya / Khanapara Border</div>
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
          <span>Region: Meghalaya / Khanapara Border</span>
          <span>Timezone: Asia/Kolkata (IST)</span>
        </div>
      </div>

      {/* 30-Day Historical Table */}
      <section style={{ marginBottom: '40px' }}>
        <div className="section-head">
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Welcome Morning Teer Previous 30 Days Records
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Historical archive of morning declarations with verified two-digit numbers.
            </p>
          </div>
          <Link
            href="/previous-results/?category=welcome-morning-teer"
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
        <h2>About Welcome Morning Teer: History, Rules, and Daily Schedule</h2>
        <p>
          <strong>Welcome Morning Teer</strong> is an established traditional archery game conducted in the border belt connecting Meghalaya and Assam. As an early morning fixture, it provides archery enthusiasts with an early round of traditional sportsmanship ahead of the midday Khanapara and afternoon Shillong rounds.
        </p>
        <p>
          The competition strictly follows traditional archery customs: skilled archers utilize hand-crafted indigenous bamboo bows and feathered cane arrows, aiming at a standardized circular target from a standard firing distance.
        </p>

        <h3>Round Structure and Timings</h3>
        <p>
          Welcome Morning Teer features two distinct shooting rounds held every morning:
        </p>
        <ul>
          <li>
            <strong>First Round (FR) — 10:30 AM IST:</strong> Archers shoot their initial complement of arrows within a designated time window. Target marshals immediately inspect the target, remove any invalid arrows that failed to stick, and group valid hits into bundles of ten. The last two digits of the total arrow count determine the First Round result (00–99).
          </li>
          <li>
            <strong>Second Round (SR) — 11:30 AM IST:</strong> Archers shoot the second series of arrows. The arrows are counted openly under the supervision of field marshals, and the final two digits determine the Second Round outcome.
          </li>
        </ul>

        <h3>Preservation of Leading Zeros</h3>
        <p>
          Every score on TeerResult adheres to the two-digit representation rule (00 to 99). If a round ends with single-digit hits such as 4 or 9, the score is formally declared and archived as <strong>04</strong> and <strong>09</strong>. This prevents database ambiguity and ensures historical statistics accurately reflect official declarations.
        </p>

        <h3>Independent Verification Standards</h3>
        <p>
          Results displayed on TeerResult are compiled directly from on-ground field declarations and verified by our editorial desk before publishing. We never use automated guessing or unverified estimates. Any official scoring corrections are logged with timestamps in our audit system to guarantee transparency.
        </p>

        <h3>Frequently Asked Questions about Welcome Morning Teer</h3>
        <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              What time is Welcome Morning Teer announced?
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              First Round (FR) is declared at 10:30 AM IST and Second Round (SR) is declared at 11:30 AM IST.
            </p>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              Are there matches on Sundays?
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              No. In accordance with regional tradition, no matches are held on Sundays or declared public holidays. Matches run Monday through Saturday.
            </p>
          </div>
        </div>
      </article>

      {/* Contextual Navigation to Other Competitions & Archive */}
      <GameQuickLinks currentSlug="welcome-morning-teer" />
    </div>
  );
}
