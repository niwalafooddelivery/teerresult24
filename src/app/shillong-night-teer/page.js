import prisma from '@/lib/prisma';
import { getTodayISTDateStr, formatISTDisplayDate, getDayOfWeekFromDateStr } from '@/lib/date-utils';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';
import GameQuickLinks from '@/components/GameQuickLinks';

export const revalidate = 60;

export const metadata = {
  title: "Shillong Night Teer Result – Today's FR & SR Scores | TeerResult",
  description:
    'Check Shillong Night Teer Result for First Round (10:30 PM) and Second Round (11:30 PM). Verified archery scores, timings, and date-wise past records on TeerResult.',
  alternates: {
    canonical: 'https://teerresult24.com/shillong-night-teer/',
  },
  openGraph: {
    title: "Shillong Night Teer Result – Today's FR & SR Scores | TeerResult",
    description:
      'Verified nightly archery session results for Shillong Night Teer. First Round (10:30 PM) & Second Round (11:30 PM IST).',
    url: 'https://teerresult24.com/shillong-night-teer/',
    siteName: 'TeerResult',
    locale: 'en_IN',
    type: 'website',
  },
};

export default async function ShillongNightTeerPage() {
  const todayStr = getTodayISTDateStr();

  let category = null;
  try {
    category = await prisma.gameCategory.findUnique({
      where: { slug: 'shillong-night-teer' },
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
    console.warn('[ShillongNightTeerPage] Database unavailable:', err.message || err);
    category = {
      name: 'Shillong Night Teer',
      slug: 'shillong-night-teer',
      location: 'Shillong, Meghalaya',
      round1Time: '10:30 PM',
      round2Time: '11:30 PM',
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
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What time is the Shillong Night Teer result declared?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The First Round (FR) is declared around 10:30 PM IST, and the Second Round (SR) is declared around 11:30 PM IST, Monday through Saturday.',
        },
      },
      {
        '@type': 'Question',
        name: 'How does Shillong Night Teer arrow counting work?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Designated archers shoot arrows into a target. Officials count the total arrows hitting the target, and the last two digits of that count form the official score (00 to 99).',
        },
      },
      {
        '@type': 'Question',
        name: 'Is Shillong Night Teer held every day?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Shillong Night Teer matches take place Monday through Saturday. Matches are traditionally suspended on Sundays and state public holidays.',
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

      <Breadcrumb items={[{ label: 'Shillong Night Teer Result' }]} />

      {/* Target Keyword H1: Shillong Night Teer Result */}
      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Shillong Night Teer Result</h1>
        <p className="hero-subtitle">
          Verified nightly archery session results: First Round (10:30 PM) &amp; Second Round (11:30 PM IST).
        </p>
        <div className="today-date-badge">
          <span>Date: {formatISTDisplayDate(todayStr)} (IST)</span>
        </div>
      </section>

      {/* Main Live Card */}
      <div className="result-card" style={{ maxWidth: '640px', margin: '0 auto 36px' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Shillong Night Teer</div>
            <div className="card-location">Authorized Archery Grounds (Night Session)</div>
          </div>
          <span className={`card-badge ${badgeClass}`}>
            {showLiveDot && <span className="status-indicator-dot" aria-hidden="true" />}
            {statusLabel}
          </span>
        </div>

        <div className="rounds-row">
          <div className="round-box">
            <div className="round-label">First Round (FR)</div>
            <div className="round-time">10:30 PM IST</div>
            <div className="round-score score-accent">
              {todayResult?.round1 ?? '--'}
            </div>
            <div className="round-status">
              {todayResult?.round1 ? (todayResult.isVerified ? 'Verified Score' : 'Field Declaration') : 'Awaiting Result'}
            </div>
          </div>

          <div className="round-box">
            <div className="round-label">Second Round (SR)</div>
            <div className="round-time">11:30 PM IST</div>
            <div className="round-score">
              {todayResult?.round2 ?? '--'}
            </div>
            <div className="round-status">
              {todayResult?.round2 ? (todayResult.isVerified ? 'Verified Score' : 'Field Declaration') : 'Awaiting Result'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>Session: Evening Archery Tally</span>
          <span>Timezone: Asia/Kolkata (IST)</span>
        </div>
      </div>

      {/* 30 Days History Table */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>
          Shillong Night Teer Previous 30 Days Records
        </h2>
        <div className="table-responsive">
          <table className="history-table" aria-label="Shillong Night Teer 30-Day Historical Results">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Day</th>
                <th scope="col">First Round (FR)</th>
                <th scope="col">Second Round (SR)</th>
                <th scope="col">Verification</th>
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
                        <span className="table-score score-highlight">
                          {r.round1 ?? '--'}
                        </span>
                      </td>
                      <td>
                        <span className="table-score">
                          {r.round2 ?? '--'}
                        </span>
                      </td>
                      <td>
                        <span className="card-badge badge-done" style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                          {r.isVerified ? 'Official Bulletin' : 'Archived'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No historical night archery records found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Comprehensive SEO Content */}
      <article className="seo-article">
        <h2>Understanding the Shillong Night Teer Session</h2>
        <p>
          Shillong Night Teer is an evening archery session organized under traditional community guidelines in Meghalaya. While standard daytime Teer matches take place during afternoon hours between 3:45 PM and 4:45 PM IST, the night session caters to enthusiasts following late archery sessions, declaring First Round results around 10:30 PM IST and Second Round results around 11:30 PM IST.
        </p>

        <h3>How Night Teer Arrow Counting Works</h3>
        <p>
          Similar to daytime Khasi Hills archery traditions, designated archers shoot a set quantity of arrows into a standardized cane target. Target marshals and score clerks extract every arrow that successfully penetrates the target circumference, verify validity, group them into tallies of ten, and count the aggregate total. The final two digits of this total constitute the official declared result number (from 00 to 99).
        </p>
        <p>
          For example, if 874 arrows land firmly on target in the first round, the declared FR score is <strong>74</strong>. If 609 arrows hit during the second round, the SR score is <strong>09</strong>. TeerResult always preserves the leading zero to guarantee technical accuracy and eliminate ambiguity.
        </p>

        <h3>Night Teer Schedule and Timing Guidelines</h3>
        <ul>
          <li><strong>Round 1 (FR):</strong> Shooting concludes by 10:15 PM IST; official verification and declaration occur around <strong>10:30 PM IST</strong>.</li>
          <li><strong>Round 2 (SR):</strong> Second quiver is loosed around 11:15 PM IST; official counting concludes around <strong>11:30 PM IST</strong>.</li>
          <li><strong>Operating Days:</strong> Monday through Saturday. Matches are traditionally suspended on Sundays and local state holidays.</li>
        </ul>

        <h3>Related Meghalaya Teer Competitions</h3>
        <p>
          During daytime hours, follow results for{' '}
          <Link href="/shillong-teer-result/">Shillong Teer Result Today</Link>,{' '}
          <Link href="/khanapara-teer-result/">Khanapara Teer Result</Link>, and{' '}
          <Link href="/juwai-teer-result/">Juwai Teer Result Today</Link>. Browse our comprehensive{' '}
          <Link href="/previous-results/">Teer Previous Results</Link> archive to analyze historical distributions.
        </p>
      </article>

      <GameQuickLinks currentSlug="shillong-night-teer" />
    </div>
  );
}
