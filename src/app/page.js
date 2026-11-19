import prisma from '@/lib/prisma';
import { getTodayISTDateStr, getYesterdayISTDateStr, formatISTDisplayDate, formatCompactDate } from '@/lib/date-utils';
import LiveResults from '@/components/LiveResults';
import PreviousResultsTable from '@/components/PreviousResultsTable';
import Link from 'next/link';

export const revalidate = 30;

export const metadata = {
  title: 'Teer Result Today – Shillong, Khanapara & Juwai Live | TeerResult',
  description:
    'Verified daily Teer Result updates for Shillong Teer, Khanapara Teer, Juwai Teer, and Shillong Night Teer. Fast, accurate, and transparent archery outcomes on TeerResult.',
  alternates: {
    canonical: 'https://teerresult24.com/',
  },
  openGraph: {
    title: 'Teer Result Today – Shillong, Khanapara & Juwai Live | TeerResult',
    description:
      'Fast, verified Teer Result live updates, educational history, and searchable past result archive on TeerResult.',
    url: 'https://teerresult24.com/',
    siteName: 'TeerResult',
    locale: 'en_IN',
    type: 'website',
  },
};

export default async function HomePage() {
  const todayStr = getTodayISTDateStr();
  const yesterdayStr = getYesterdayISTDateStr();

  // Primary 4 categories ordered
  const primarySlugs = ['shillong-teer', 'khanapara-teer', 'juwai-teer', 'shillong-night-teer'];

  let categories = [];
  try {
    categories = await prisma.gameCategory.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        location: true,
        round1Time: true,
        round2Time: true,
        order: true,
        results: {
          where: {
            dateStr: {
              in: [todayStr, yesterdayStr],
            },
          },
          select: {
            dateStr: true,
            round1: true,
            round2: true,
            status: true,
            isVerified: true,
            sourceInfo: true,
            updatedAt: true,
          },
        },
      },
    });
  } catch (dbError) {
    console.warn('[HomePage] Database unavailable at render time, using safe category fallbacks:', dbError.message || dbError);
    categories = [
      {
        id: 'shillong-teer-default',
        name: 'Shillong Teer',
        slug: 'shillong-teer',
        location: 'Polo Grounds, Shillong, Meghalaya',
        round1Time: '03:45 PM',
        round2Time: '04:45 PM',
        order: 1,
        results: [],
      },
      {
        id: 'khanapara-teer-default',
        name: 'Khanapara Teer',
        slug: 'khanapara-teer',
        location: 'Khanapara, Guwahati, Assam',
        round1Time: '04:10 PM',
        round2Time: '04:45 PM',
        order: 2,
        results: [],
      },
      {
        id: 'juwai-teer-default',
        name: 'Juwai Teer',
        slug: 'juwai-teer',
        location: 'Juwai, West Jaintia Hills, Meghalaya',
        round1Time: '02:00 PM',
        round2Time: '02:45 PM',
        order: 3,
        results: [],
      },
      {
        id: 'shillong-night-teer-default',
        name: 'Shillong Night Teer',
        slug: 'shillong-night-teer',
        location: 'Shillong, Meghalaya',
        round1Time: '10:30 PM',
        round2Time: '11:30 PM',
        order: 4,
        results: [],
      },
    ];
  }

  // Sort by primarySlugs
  categories.sort((a, b) => {
    const ai = primarySlugs.indexOf(a.slug);
    const bi = primarySlugs.indexOf(b.slug);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  // Prepare Today's live cards
  const todayResults = categories.map((cat) => {
    const res = cat.results.find((r) => r.dateStr === todayStr) || null;
    const isDeclared = Boolean(res?.round1 && res?.round2);
    const isPartial = Boolean(res?.round1 && !res?.round2);
    const isVerified = Boolean(res?.isVerified);

    let statusLabel = 'Awaiting Result';
    if (isDeclared && isVerified) statusLabel = 'LIVE';
    else if (isPartial && isVerified) statusLabel = '1st Round Declared';
    else if (res?.status === 'CANCELLED') statusLabel = 'Cancelled';

    return {
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      location: cat.location,
      round1Time: cat.round1Time,
      round2Time: cat.round2Time,
      round1: res?.round1 || null,
      round2: res?.round2 || null,
      status: res?.status || 'PENDING',
      statusLabel,
      isVerified: Boolean(res?.isVerified),
      sourceInfo: res?.sourceInfo || 'Official Archery Record',
      updatedAt: res?.updatedAt ? new Date(res.updatedAt).toISOString() : null,
    };
  });

  // Prepare Yesterday's declared summary
  const yesterdaySummary = categories.map((cat) => {
    const res = cat.results.find((r) => r.dateStr === yesterdayStr) || null;
    return {
      name: cat.name,
      slug: cat.slug,
      dateFormatted: formatCompactDate(yesterdayStr),
      round1: res?.round1 || '--',
      round2: res?.round2 || '--',
      isDeclared: Boolean(res?.round1 && res?.round2),
    };
  });

  // Get recent 10 results for compact historical preview
  let recentHistory = [];
  try {
    recentHistory = await prisma.teerResult.findMany({
      orderBy: { dateStr: 'desc' },
      take: 10,
      select: {
        id: true,
        dateStr: true,
        round1: true,
        round2: true,
        isVerified: true,
        category: {
          select: {
            name: true,
            slug: true,
            location: true,
            round1Time: true,
            round2Time: true,
          },
        },
      },
    });
  } catch (recentErr) {
    console.warn('[HomePage] Failed to fetch recentHistory from DB:', recentErr.message || recentErr);
    recentHistory = [];
  }

  const displayDateIST = formatISTDisplayDate(todayStr);

  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      {/* 1. Main H1 Header & IST Date */}
      <section className="hero-banner">
        <h1 className="hero-title">Teer Result Today – Shillong, Khanapara & Juwai</h1>
        <p className="hero-subtitle">
          Verified daily archery outcomes for Shillong Teer, Khanapara Teer, Juwai Teer, and Shillong Night Teer.
        </p>
        <div className="today-date-badge">
          <span>{displayDateIST}</span>
        </div>
      </section>

      {/* 2. Today's Live Result Cards Grid */}
      <LiveResults initialData={todayResults} currentDateStr={todayStr} />

      {/* 3. Yesterday's Results Section */}
      <section style={{ margin: '40px 0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              Yesterday&apos;s Declared Results
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Official finalized scores for {formatCompactDate(yesterdayStr)}
            </p>
          </div>
          <Link
            href="/previous-results/"
            style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 600 }}
          >
            Full Archive &rarr;
          </Link>
        </div>

        <div className="yesterday-grid">
          {yesterdaySummary.map((item) => {
            const gameHref = item.slug === 'shillong-night-teer' ? '/shillong-night-teer/' : `/${item.slug}-result/`;
            return (
              <div key={item.slug} className="yesterday-card">
                <div>
                  <Link href={gameHref} style={{ textDecoration: 'none' }}>
                    <div className="yesterday-game-name">{item.name}</div>
                  </Link>
                  <div className="yesterday-date">{item.dateFormatted}</div>
                </div>

                <div className="yesterday-scores">
                  <div className="y-score-pill">
                    <span className="y-score-tag">FR</span>
                    <span className="y-score-val fr-val">{item.round1}</span>
                  </div>
                  <div className="y-score-pill">
                    <span className="y-score-tag">SR</span>
                    <span className="y-score-val sr-val">{item.round2}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. Compact Historical Archive Section */}
      <section style={{ margin: '40px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Historical Results Archive
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Recent verified archery score tallies with leading zero retention (00 to 99).
            </p>
          </div>
          <Link
            href="/previous-results/"
            style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 600 }}
          >
            View All Dates &rarr;
          </Link>
        </div>

        <div className="table-responsive">
          <table className="history-table" aria-label="Recent Verified Teer Results">
            <thead>
              <tr>
                <th scope="col">Date (IST)</th>
                <th scope="col">Game / Session</th>
                <th scope="col">First Round (FR)</th>
                <th scope="col">Second Round (SR)</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentHistory.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)' }}>
                    Daily archival records are updated following official association score declarations.
                  </td>
                </tr>
              ) : (
                recentHistory.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>{item.dateStr}</td>
                    <td>
                      <Link
                        href={item.category.slug === 'shillong-night-teer' ? '/shillong-night-teer/' : `/${item.category.slug}-result/`}
                        style={{ color: 'var(--text-main)', textDecoration: 'none', fontWeight: 600 }}
                      >
                        {item.category.name}
                      </Link>
                    </td>
                    <td>
                      <span className="table-score score-highlight">{item.round1 || '--'}</span>
                    </td>
                    <td>
                      <span className="table-score">{item.round2 || '--'}</span>
                    </td>
                    <td>
                      <span className={`card-badge ${item.isVerified ? 'badge-live' : 'badge-done'}`} style={{ fontSize: '0.72rem', padding: '2px 8px' }}>
                        {item.isVerified ? 'Verified' : 'Archived'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Source, Transparency & Correction Policy Banner */}
      <section style={{ margin: '32px 0' }}>
        <div className="source-banner">
          <div>
            <strong>Independent Archery Information &amp; Official Verification:</strong> All archery outcomes published on TeerResult are recorded from public announcements at authorized grounds under the Meghalaya Amusements and Betting Tax (Amendment) Act 1982. We do not participate in, host, or encourage wagering. Results are strictly logged in Indian Standard Time (IST / UTC+05:30). If any official revision or recount occurs, our records are audited and corrected immediately in accordance with our{' '}
            <Link href="/correction-policy/" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
              Correction Policy
            </Link>
            .
          </div>
        </div>
      </section>

      {/* 6. Comprehensive Educational Content & FAQs */}
      <article className="seo-article">
        <h2>About Traditional Meghalaya Archery (Teer)</h2>
        <p>
          Teer is a traditional sport of archery deeply rooted in the cultural history of Meghalaya, primarily organized by the Khasi Hills Archery Sports Association (KHASA) and authorized clubs in West Jaintia Hills and the Khanapara border. Unlike automated lotteries, Teer outcomes are determined by the precision of physical arrows shot into standardized targets.
        </p>

        <h3>How Results are Calculated</h3>
        <p>
          During an official session, licensed archers shoot arrows within a specified timeframe. Once shooting concludes, target marshals collect, inspect, and count the valid arrows in groups of ten. The final declared number represents the last two digits of the total arrow count. For example, if 748 arrows land on target, the declared score is 48.
        </p>

        <h3>Archery Rounds &amp; Timings</h3>
        <ul>
          <li><strong>Juwai Teer:</strong> First Round at 2:05 PM IST | Second Round at 2:45 PM IST</li>
          <li><strong>Shillong Teer:</strong> First Round at 3:45 PM IST | Second Round at 4:45 PM IST</li>
          <li><strong>Khanapara Teer:</strong> First Round at 4:10 PM IST | Second Round at 4:45 PM IST</li>
          <li><strong>Shillong Night Teer:</strong> First Round at 10:15 PM IST | Second Round at 11:15 PM IST</li>
        </ul>

        <h3>Frequently Asked Questions</h3>
        <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              What does FR and SR mean in Teer results?
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              FR stands for First Round (the first shooting session of the afternoon or night), while SR stands for Second Round (the follow-up session conducted after a brief intermission).
            </p>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              Why does TeerResult show &quot;--&quot; for upcoming rounds?
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              We adhere strictly to factual journalism. When a round has not yet concluded or the arrows have not been officially declared, we display &quot;--&quot; rather than fictitious predictions or unauthorized estimates.
            </p>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              Are Teer games conducted on Sundays?
            </h4>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              No. Official archery games are held Monday through Saturday. Sunday is an official rest day with no declared sessions.
            </p>
          </div>
        </div>
      </article>

      {/* Structured Data (JSON-LD) for Search Engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'TeerResult',
              url: 'https://teerresult24.com/',
              description: 'Verified daily archery results for Shillong, Khanapara, Juwai, and Night Teer.',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://teerresult24.com/previous-results/?date={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: 'What does FR and SR mean in Teer results?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'FR stands for First Round (the first shooting session of the afternoon or night), while SR stands for Second Round (the follow-up session conducted after a brief intermission).',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Why does TeerResult show "--" for upcoming rounds?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'We adhere strictly to factual reporting. When a round has not yet concluded or arrows have not been officially counted, we display "--" rather than fictitious predictions or unauthorized estimates.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'Are Teer games conducted on Sundays?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'No. Official archery matches are held Monday through Saturday. Sunday is an official rest day with no declared sessions.',
                  },
                },
              ],
            },
          ]),
        }}
      />
    </div>
  );
}
