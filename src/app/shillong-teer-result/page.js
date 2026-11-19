import prisma from '@/lib/prisma';
import { getTodayISTDateStr, formatISTDisplayDate, getDayOfWeekFromDateStr } from '@/lib/date-utils';
import Link from 'next/link';

export const revalidate = 60;

export const metadata = {
  title: 'Shillong Teer Result Today - FR & SR Live | TeerResult',
  description:
    'Live Shillong Teer Result Today for First Round (03:45 PM) & Second Round (04:45 PM). Real-time verified archery numbers, KHASA Polo Ground updates, and 30-day past history on TeerResult.',
  alternates: {
    canonical: 'https://teerresult24.com/shillong-teer-result/',
  },
};

export default async function ShillongTeerPage() {
  const todayStr = getTodayISTDateStr();

  let category = null;
  try {
    category = await prisma.gameCategory.findUnique({
      where: { slug: 'shillong-teer' },
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
    console.warn('[ShillongTeerPage] Database unavailable:', err.message || err);
    category = {
      name: 'Shillong Teer',
      slug: 'shillong-teer',
      location: 'Polo Grounds, Shillong, Meghalaya',
      round1Time: '03:45 PM',
      round2Time: '04:45 PM',
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
        <Link href="/">Home</Link> &gt; <span>Shillong Teer Result</span>
      </nav>

      {/* Unique Exact H1 for Shillong */}
      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Shillong Teer Result Today - FR &amp; SR</h1>
        <p className="hero-subtitle">
          Official Khasi Hills Archery Sports Association (KHASA) daily first round and second round scores from Polo Ground, Shillong.
        </p>
        <div className="today-date-badge">
          <span>Date: {formatISTDisplayDate(todayStr)} (IST)</span>
        </div>
      </section>

      {/* Dedicated Shillong Result Card */}
      <div className="result-card" style={{ maxWidth: '640px', margin: '0 auto 36px' }}>
        <div className="card-header">
          <div>
            <div className="card-title">Shillong Teer</div>
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
            <div className="round-time">03:45 PM IST</div>
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
          <span>Ground Authority: KHASA Licensed Clubs</span>
          <span>Timezone: Asia/Kolkata (IST)</span>
        </div>
      </div>

      {/* 30-Day Historical Table */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '16px' }}>
          Shillong Teer Previous 30 Days Records
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
        <h2>About Shillong Teer: History, Rules, and Daily Schedule</h2>
        <p>
          Shillong Teer is one of the most culturally significant traditional sports in Northeast India. Governed by the Meghalaya Amusements and Betting Tax Act, the sport is administered by the <strong>Khasi Hills Archery Sports Association (KHASA)</strong>, a coalition of 12 traditional archery clubs headquartered at the historic Polo Ground in Shillong.
        </p>
        <p>
          Unlike computerized lotteries or games based on pseudorandom number generators, Shillong Teer is an authentic physical sport. In every daily session, fifty licensed traditional archers shoot bamboo cane arrows at a standardized cylindrical target situated roughly fifty meters away.
        </p>

        <h3>Shooting Timings and Round Structure</h3>
        <p>
          Shillong Teer is divided into two distinct daily phases:
        </p>
        <ul>
          <li>
            <strong>First Round (FR) - 03:45 PM IST:</strong> Fifty archers shoot thirty traditional cane arrows each within five minutes. Officials carefully gather all valid arrows embedded within the target and group them into bundles of ten. The last two digits of the total arrow count form the First Round number.
          </li>
          <li>
            <strong>Second Round (SR) - 04:45 PM IST:</strong> Archers return for the concluding round, firing twenty arrows each in a three-minute span. The arrows are counted in the same transparent manner, and the final two digits determine the Second Round number.
          </li>
        </ul>

        <h3>Preservation of Leading Zeros</h3>
        <p>
          At TeerResult, we adhere strictly to official two-digit standards (00 to 99). If 804 arrows hit the target in the first round, the declared number is strictly recorded as <strong>04</strong>, rather than truncated to 4. This maintains data consistency across our historical database and prevents confusion for enthusiasts tracking archery score distributions.
        </p>

        <h3>Frequently Asked Questions about Shillong Teer</h3>
        <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              Where does the official Shillong Teer counting take place?
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              All arrows are shot, inspected, and counted openly at Polo Grounds in Shillong under the supervision of KHASA field marshals.
            </p>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              On which days is Shillong Teer played?
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Matches are held six days a week from Monday to Saturday. No matches are played on Sundays or official Meghalaya state holidays.
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
