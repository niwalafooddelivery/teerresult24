import prisma from '@/lib/prisma';
import { getTodayISTDateStr, formatISTDisplayDate } from '@/lib/date-utils';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Khanapara Teer Result Today - FR & SR Live | TeerResult',
  description:
    'Live Khanapara Teer Result Today for First Round (04:10 PM) & Second Round (04:45 PM). Official Assam border archery outcomes, timely updates, and 30-day past history on TeerResult.',
  alternates: {
    canonical: 'https://teerresult24.com/khanapara-teer-result/',
  },
};

export default async function KhanaparaTeerPage() {
  const todayStr = getTodayISTDateStr();

  let category = null;
  try {
    category = await prisma.gameCategory.findUnique({
      where: { slug: 'khanapara-teer' },
      include: {
        results: {
          orderBy: { dateStr: 'desc' },
          take: 30,
        },
      },
    });
  } catch (err) {
    console.warn('[KhanaparaTeerPage] Database unavailable:', err.message || err);
    category = {
      name: 'Khanapara Teer',
      slug: 'khanapara-teer',
      location: 'Khanapara, Guwahati, Assam',
      round1Time: '04:10 PM',
      round2Time: '04:45 PM',
      results: [],
    };
  }

  const todayResult = category?.results.find((r) => r.dateStr === todayStr);
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
        <Link href="/">Home</Link> &gt; <span>Khanapara Teer Result</span>
      </nav>

      {/* Unique Exact H1 for Khanapara */}
      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Khanapara Teer Result Today - FR &amp; SR</h1>
        <p className="hero-subtitle">
          Daily official archery outcomes from Khanapara, located along the Assam-Meghalaya border. First Round (4:10 PM) &amp; Second Round (4:45 PM IST).
        </p>
        <div className="today-date-badge">
          <span>Date: {formatISTDisplayDate(todayStr)} (IST)</span>
        </div>
      </section>

      {/* Dedicated Khanapara Result Card */}
      <div className="result-card" style={{ maxWidth: '640px', margin: '0 auto 36px' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Khanapara Teer</div>
            <div className="card-location">Khanapara, Ri-Bhoi / Guwahati Border</div>
          </div>
          <span className={`card-badge ${badgeClass}`}>
            {showLiveDot && <span className="status-indicator-dot" aria-hidden="true" />}
            {statusLabel}
          </span>
        </div>

        <div className="rounds-row">
          <div className="round-box">
            <div className="round-label">First Round (FR)</div>
            <div className="round-time">04:10 PM IST</div>
            <div className="round-score score-accent">
              {todayResult?.round1 ?? '--'}
            </div>
            <div className="round-status">
              {todayResult?.round1 ? (todayResult.isVerified ? 'Verified Score' : 'Field Declaration') : 'Awaiting Result'}
            </div>
          </div>

          <div className="round-box">
            <div className="round-label">Second Round (SR)</div>
            <div className="round-time">04:45 PM IST</div>
            <div className="round-score">
              {todayResult?.round2 ?? '--'}
            </div>
            <div className="round-status">
              {todayResult?.round2 ? (todayResult.isVerified ? 'Verified Score' : 'Field Declaration') : 'Awaiting Result'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <span>Session: Afternoon Archery Club</span>
          <span>Timezone: Asia/Kolkata (IST)</span>
        </div>
      </div>

      {/* 30-Day Historical Table */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>
          Khanapara Teer Previous 30 Days Records
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
        <h2>About Khanapara (Assam) Teer: History and Schedule</h2>
        <p>
          Khanapara Teer—frequently referred to as Assam Teer or Guwahati Teer—is organized on the boundary separating Ri-Bhoi district of Meghalaya and Kamrup Metropolitan district of Assam. It attracts widespread attention across the Brahmaputra Valley and surrounding regions due to its slightly staggered afternoon schedule compared to Shillong Teer.
        </p>

        <h3>Archery Timings for Khanapara</h3>
        <ul>
          <li>
            <strong>First Round (FR) - 04:10 PM IST:</strong> Shooting occurs in the late afternoon. Scores are tabulated swiftly and announced between 04:15 PM and 04:20 PM IST.
          </li>
          <li>
            <strong>Second Round (SR) - 04:45 PM IST:</strong> The closing round finishes around 04:45 PM, with the final arrow count published by 04:55 PM IST.
          </li>
        </ul>

        <h3>Difference between Shillong and Khanapara Teer</h3>
        <p>
          While both clubs follow identical Khasi archery counting principles, they are entirely independent sporting associations situated at different venues. Khanapara archers shoot at their own designated range, and their arrow counts have no direct numerical relationship with Shillong results.
        </p>

        <h3>Khanapara Teer FAQs</h3>
        <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              Are Khanapara and Assam Teer the same game?
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Yes. Due to Khanapara&apos;s location immediately adjacent to Guwahati, local participants often refer to it interchangeably as Assam Teer or Khanapara Teer.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
