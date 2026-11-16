import prisma from '@/lib/prisma';
import { getTodayISTDateStr, formatISTDisplayDate } from '@/lib/date-utils';
import Link from 'next/link';

export const metadata = {
  title: 'Shillong Night Teer Result Today - FR & SR Live | TeerResult2',
  description:
    'Check Shillong Night Teer result live for Round 1 (10:15 PM) and Round 2 (11:15 PM). Verified archery scores, timing, and date-wise past records on TeerResult2.',
  alternates: {
    canonical: 'https://teerresult2.com/shillong-night-teer/',
  },
};

export default async function ShillongNightTeerPage() {
  const todayStr = getTodayISTDateStr();

  const category = await prisma.gameCategory.findUnique({
    where: { slug: 'shillong-night-teer' },
    include: {
      results: {
        orderBy: { dateStr: 'desc' },
        take: 30,
      },
    },
  });

  const todayResult = category?.results.find((r) => r.dateStr === todayStr);
  const isDeclared = Boolean(todayResult?.round1 && todayResult?.round2);
  const isPartial = Boolean(todayResult?.round1 && !todayResult?.round2);

  let statusLabel = 'Awaiting Result';
  if (isDeclared) statusLabel = 'Declared';
  else if (isPartial) statusLabel = '1st Round Declared';

  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <nav style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link href="/">Home</Link> &gt; <span>Shillong Night Teer</span>
      </nav>

      {/* Unique Exact H1 for Shillong Night */}
      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Shillong Night Teer Result Today</h1>
        <p className="hero-subtitle">
          Verified nightly archery session results: First Round (10:15 PM) &amp; Second Round (11:15 PM IST).
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
          <span className={`card-badge ${isDeclared ? 'badge-live' : 'badge-done'}`}>
            {statusLabel}
          </span>
        </div>

        <div className="rounds-row">
          <div className="round-box">
            <div className="round-label">First Round (FR)</div>
            <div className="round-time">10:15 PM IST</div>
            <div className="round-score score-accent">
              {todayResult?.round1 ?? '--'}
            </div>
            <div className="round-status">
              {todayResult?.round1 ? 'Declared' : 'Awaiting Result'}
            </div>
          </div>

          <div className="round-box">
            <div className="round-label">Second Round (SR)</div>
            <div className="round-time">11:15 PM IST</div>
            <div className="round-score">
              {todayResult?.round2 ?? '--'}
            </div>
            <div className="round-status">
              {todayResult?.round2 ? 'Declared' : 'Awaiting Result'}
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
          <table className="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>First Round (FR)</th>
                <th>Second Round (SR)</th>
                <th>Verification</th>
              </tr>
            </thead>
            <tbody>
              {category?.results && category.results.length > 0 ? (
                category.results.map((r) => {
                  const d = new Date(r.dateStr + 'T12:00:00+05:30');
                  const dayName = d.toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'Asia/Kolkata' });
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
          Shillong Night Teer is an evening archery session organized under traditional community guidelines in Meghalaya. While standard daytime Teer matches take place during afternoon hours between 3:45 PM and 4:45 PM IST, the night session caters to enthusiasts following late archery sessions, declaring First Round results at 10:15 PM IST and Second Round results at 11:15 PM IST.
        </p>

        <h3>How Night Teer Arrow Counting Works</h3>
        <p>
          Similar to standard Khasi Hills archery traditions, designated archers shoot a set quantity of arrows into a standardized cane target. Target marshals and score clerks extract every arrow that successfully penetrates the target circumference, verify validity, group them into tallies of ten, and count the aggregate total. The final two digits of this total constitute the official declared result number (from 00 to 99).
        </p>
        <p>
          For example, if 874 arrows land firmly on target in the first round, the declared FR score is <strong>74</strong>. If 609 arrows hit during the second round, the SR score is <strong>09</strong>. TeerResult2 always preserves the leading zero to guarantee technical accuracy and eliminate ambiguity.
        </p>

        <h3>Night Teer Schedule and Timing Guidelines</h3>
        <ul>
          <li><strong>Round 1 (FR):</strong> Shooting concludes by 10:00 PM IST; official verification and declaration occur at <strong>10:15 PM IST</strong>.</li>
          <li><strong>Round 2 (SR):</strong> Second quiver is loosed around 11:00 PM IST; official counting concludes at <strong>11:15 PM IST</strong>.</li>
          <li><strong>Operating Days:</strong> Monday through Saturday. Matches are traditionally suspended on Sundays and local state holidays.</li>
        </ul>

        <h3>Frequently Asked Questions about Shillong Night Teer</h3>
        <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              At what time is Shillong Night Teer declared?
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              The First Round (FR) is declared at 10:15 PM IST, and the Second Round (SR) is declared at 11:15 PM IST.
            </p>
          </div>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              How does TeerResult2 verify night results?
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              We record scores directly from corroborated score bulletins, verifying two-digit integrity (00 to 99) before publishing. If a number is pending, we strictly display <code>--</code> rather than speculative predictions.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
