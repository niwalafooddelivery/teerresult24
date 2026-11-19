import prisma from '@/lib/prisma';
import { getTodayISTDateStr, formatISTDisplayDate, getDayOfWeekFromDateStr } from '@/lib/date-utils';
import Link from 'next/link';

export const revalidate = 60;

export const metadata = {
  title: 'Juwai Teer Result Today - FR & SR Live | TeerResult',
  description:
    'Live Juwai Teer Result Today for First Round (02:05 PM) & Second Round (02:45 PM). Real-time West Jaintia Hills archery outcome announcements and 30-day archive on TeerResult.',
  alternates: {
    canonical: 'https://teerresult24.com/juwai-teer-result/',
  },
};

export default async function JuwaiTeerPage() {
  const todayStr = getTodayISTDateStr();

  let category = null;
  try {
    category = await prisma.gameCategory.findUnique({
      where: { slug: 'juwai-teer' },
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
    console.warn('[JuwaiTeerPage] Database unavailable:', err.message || err);
    category = {
      name: 'Juwai Teer',
      slug: 'juwai-teer',
      location: 'Juwai, West Jaintia Hills, Meghalaya',
      round1Time: '02:00 PM',
      round2Time: '02:45 PM',
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

  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <nav style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link href="/">Home</Link> &gt; <span>Juwai Teer Result</span>
      </nav>

      {/* Unique Exact H1 for Juwai */}
      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Juwai Teer Result Today - FR &amp; SR</h1>
        <p className="hero-subtitle">
          Official archery outcomes from Jowai, West Jaintia Hills, Meghalaya. First Round (2:05 PM) &amp; Second Round (2:45 PM IST).
        </p>
        <div className="today-date-badge">
          <span>Date: {formatISTDisplayDate(todayStr)} (IST)</span>
        </div>
      </section>

      {/* Dedicated Juwai Result Card */}
      <div className="result-card" style={{ maxWidth: '640px', margin: '0 auto 36px' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Juwai Teer</div>
            <div className="card-location">Jowai, West Jaintia Hills, Meghalaya</div>
          </div>
          <span className={`card-badge ${badgeClass}`}>
            {showLiveDot && <span className="status-indicator-dot" aria-hidden="true" />}
            {statusLabel}
          </span>
        </div>

        <div className="rounds-row">
          <div className="round-box">
            <div className="round-label">First Round (FR)</div>
            <div className="round-time">02:05 PM IST</div>
            <div className="round-score score-accent">
              {todayResult?.round1 ?? '--'}
            </div>
            <div className="round-status">
              {todayResult?.round1 ? (todayResult.isVerified ? 'Verified Score' : 'Field Declaration') : 'Awaiting Result'}
            </div>
          </div>

          <div className="round-box">
            <div className="round-label">Second Round (SR)</div>
            <div className="round-time">02:45 PM IST</div>
            <div className="round-score">
              {todayResult?.round2 ?? '--'}
            </div>
            <div className="round-status">
              {todayResult?.round2 ? (todayResult.isVerified ? 'Verified Score' : 'Field Declaration') : 'Awaiting Result'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>Session: Early Afternoon Match</span>
          <span>Timezone: Asia/Kolkata (IST)</span>
        </div>
      </div>

      {/* 30-Day Historical Table */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>
          Juwai Teer Previous 30 Days Records
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
                        <span className={`card-badge ${r.isVerified ? 'badge-live' : 'badge-done'}`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                          {r.isVerified ? 'Verified Bulletin' : 'Unverified Record'}
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
                      Verified historical outcomes will appear here following official association declarations.
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
        <h2>About Juwai (Jowai) Teer: Timings and Heritage</h2>
        <p>
          Jowai is the historic administrative centre of the West Jaintia Hills district in Meghalaya. The local archery tradition in Jowai predates modern sporting codes and takes place earlier in the day than Shillong or Khanapara matches.
        </p>

        <h3>Earliest Daily Teer Declarations</h3>
        <p>
          Because Juwai Teer shoots earlier, it is typically the first result released each day:
        </p>
        <ul>
          <li><strong>First Round (FR):</strong> Shooting commences shortly after 01:30 PM, with official counts declared around <strong>02:05 PM IST</strong>.</li>
          <li><strong>Second Round (SR):</strong> The afternoon session concludes around <strong>02:45 PM IST</strong>.</li>
        </ul>

        <h3>Official Guidelines</h3>
        <p>
          Like all recognized Teer events in Meghalaya, shooting is conducted under state community permits. Results are calculated strictly by counting arrows hitting the target, taking the last two digits.
        </p>
      </article>
    </div>
  );
}
