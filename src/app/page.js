import prisma from '@/lib/prisma';
import { getTodayISTDateStr, getYesterdayISTDateStr, formatISTDisplayDate, formatCompactDate, getGameUrl } from '@/lib/date-utils';
import LiveResults from '@/components/LiveResults';
import Link from 'next/link';
import GameQuickLinks from '@/components/GameQuickLinks';

export const revalidate = 30;

export const metadata = {
  title: 'Teer Result Today – Shillong, Khanapara, Juwai & Morning Live | TeerResult',
  description:
    'Verified daily Teer Result updates for Shillong Teer, Khanapara Teer, Juwai Teer, Shillong Night Teer, Shillong Morning Teer, and Welcome Morning Teer. Fast, accurate archery outcomes.',
  alternates: {
    canonical: 'https://teerresult24.com/',
  },
  openGraph: {
    title: 'Teer Result Today – Shillong, Khanapara, Juwai & Morning Live | TeerResult',
    description:
      'Fast, verified Teer Result live updates, educational history, and searchable past result archive for all six major archery games.',
    url: 'https://teerresult24.com/',
    siteName: 'TeerResult',
    locale: 'en_IN',
    type: 'website',
  },
};

export default async function HomePage() {
  const todayStr = getTodayISTDateStr();
  const yesterdayStr = getYesterdayISTDateStr();

  // All 6 competition categories in canonical priority order
  const primarySlugs = [
    'shillong-teer',
    'khanapara-teer',
    'juwai-teer',
    'shillong-night-teer',
    'shillong-morning-teer',
    'welcome-morning-teer',
  ];

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
        id: 'shillong-teer',
        name: 'Shillong Teer',
        slug: 'shillong-teer',
        location: 'Polo Grounds, Shillong, Meghalaya',
        round1Time: '03:45 PM',
        round2Time: '04:45 PM',
        order: 1,
        results: [],
      },
      {
        id: 'khanapara-teer',
        name: 'Khanapara Teer',
        slug: 'khanapara-teer',
        location: 'Ri-Bhoi District, Assam/Meghalaya Border',
        round1Time: '04:10 PM',
        round2Time: '04:45 PM',
        order: 2,
        results: [],
      },
      {
        id: 'juwai-teer',
        name: 'Juwai Teer',
        slug: 'juwai-teer',
        location: 'Jowai, West Jaintia Hills, Meghalaya',
        round1Time: '02:05 PM',
        round2Time: '02:45 PM',
        order: 3,
        results: [],
      },
      {
        id: 'shillong-night-teer',
        name: 'Shillong Night Teer',
        slug: 'shillong-night-teer',
        location: 'Polo Grounds / Authorized Club (Night Session)',
        round1Time: '10:15 PM',
        round2Time: '11:15 PM',
        order: 4,
        results: [],
      },
      {
        id: 'shillong-morning-teer',
        name: 'Shillong Morning Teer',
        slug: 'shillong-morning-teer',
        location: 'Polo Grounds / Morning Session, Shillong, Meghalaya',
        round1Time: '10:30 AM',
        round2Time: '11:30 AM',
        order: 5,
        results: [],
      },
      {
        id: 'welcome-morning-teer',
        name: 'Welcome Morning Teer',
        slug: 'welcome-morning-teer',
        location: 'Meghalaya / Assam Border Morning Archery Club',
        round1Time: '10:30 AM',
        round2Time: '11:30 AM',
        order: 6,
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

  // Prepare Today's live cards (all 6 games)
  const todayResults = categories.map((cat) => {
    const res = cat.results?.find((r) => r.dateStr === todayStr) || null;
    const isDeclared = Boolean(res?.round1 && res?.round2);
    const isPartial = Boolean(res?.round1 && !res?.round2);
    const isVerified = Boolean(res?.isVerified);

    let statusLabel = 'Awaiting Result';
    if (isDeclared && isVerified) statusLabel = 'LIVE';
    else if (isPartial && isVerified) statusLabel = '1st Round Declared';
    else if (isDeclared && !isVerified) statusLabel = 'Pending Review';
    else if (isPartial && !isVerified) statusLabel = 'FR Under Review';
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
      sourceInfo: res?.sourceInfo || 'Official Field Record',
      updatedAt: res?.updatedAt ? new Date(res.updatedAt).toISOString() : null,
    };
  });

  // Prepare Yesterday's declared summary (all 6 games)
  const yesterdaySummary = categories.map((cat) => {
    const res = cat.results?.find((r) => r.dateStr === yesterdayStr) || null;
    return {
      name: cat.name,
      slug: cat.slug,
      dateFormatted: formatCompactDate(yesterdayStr),
      round1: res?.round1 || '--',
      round2: res?.round2 || '--',
      isDeclared: Boolean(res?.round1 && res?.round2),
    };
  });

  // Get recent 12 results for compact historical preview
  let recentHistory = [];
  try {
    recentHistory = await prisma.teerResult.findMany({
      orderBy: { dateStr: 'desc' },
      take: 12,
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
        <h1 className="hero-title">Teer Result Today – Shillong, Khanapara, Juwai &amp; Morning</h1>
        <p className="hero-subtitle">
          Verified daily archery outcomes for Shillong Teer, Khanapara Teer, Juwai Teer, Shillong Night Teer, Shillong Morning Teer, and Welcome Morning Teer.
        </p>
        <div className="today-date-badge">
          <span>{displayDateIST} (IST / UTC+05:30)</span>
        </div>
      </section>

      {/* 2. Today's Live Result Cards Grid (All 6 Games) */}
      <LiveResults initialData={todayResults} currentDateStr={todayStr} />

      {/* 3. Yesterday's Results Section */}
      <section style={{ margin: '40px 0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em', margin: 0 }}>
              Yesterday&apos;s Declared Results
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Finalized two-round scores for {formatCompactDate(yesterdayStr)}
            </p>
          </div>
          <Link
            href="/previous-results/"
            style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'none' }}
          >
            Full Archive &rarr;
          </Link>
        </div>

        <div className="yesterday-grid">
          {yesterdaySummary.map((item) => {
            const gameHref = getGameUrl(item.slug);
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Historical Results Archive
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Recent verified archery score tallies with leading zero retention (00 to 99).
            </p>
          </div>
          <Link
            href="/previous-results/"
            style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 600, textDecoration: 'none' }}
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
                        href={getGameUrl(item.category.slug)}
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

      {/* 6. Comprehensive Educational Content Covering All 13 Sections */}
      <article className="seo-article">
        {/* Section 1: Overview */}
        <h2>1. Teer Result Today — Overview</h2>
        <p>
          Welcome to <strong>TeerResult24</strong>, an independent digital archive and live publication platform dedicated to providing timely, accurate, and verified traditional archery outcomes from the northeastern states of Meghalaya and Assam. Traditional archery (locally known as <em>Teer</em> or <em>Siat Khnam</em>) represents a centuries-old cultural discipline regulated under state amusement frameworks. Every weekday and Saturday, archers assemble at designated shooting grounds to conduct regulated rounds under authorized association stewards.
        </p>
        <p>
          Our platform tracks all six major sanctioned competitions: <strong>Shillong Teer</strong>, <strong>Khanapara Teer</strong>, <strong>Juwai Teer</strong>, <strong>Shillong Night Teer</strong>, <strong>Shillong Morning Teer</strong>, and <strong>Welcome Morning Teer</strong>. Every declared score is presented in its canonical two-digit format (00 to 99), preserving critical leading zeros such as 04 and 09.
        </p>

        {/* Section 2: Shillong Teer Results */}
        <h2>2. Shillong Teer Results</h2>
        <p>
          Organized by the Khasi Hills Archery Sports Association (KHASA) at the historic Polo Grounds in Shillong, Meghalaya, <strong>Shillong Teer</strong> is the flagship traditional archery tournament of the region. The event brings together archers representing twelve affiliated Khasi clubs who shoot indigenous bamboo arrows at a cylindrical target over a specified distance.
        </p>
        <ul>
          <li><strong>First Round (FR):</strong> Shooting commences in the afternoon, with final arrow counts declared at approximately <strong>03:45 PM IST</strong>.</li>
          <li><strong>Second Round (SR):</strong> The concluding round follows after a rest interval, with numbers declared at approximately <strong>04:45 PM IST</strong>.</li>
          <li><strong>Venue:</strong> Polo Grounds, Shillong, East Khasi Hills, Meghalaya.</li>
        </ul>

        {/* Section 3: Khanapara Teer Results */}
        <h2>3. Khanapara Teer Results</h2>
        <p>
          Conducted along the Assam–Meghalaya interstate boundary in the Ri-Bhoi district adjacent to Guwahati, <strong>Khanapara Teer</strong> (often referred to as Assam Teer or Guwahati Teer) features competitive teams from both states. The tournament adheres to strict time frames and counting protocols.
        </p>
        <ul>
          <li><strong>First Round (FR):</strong> Scheduled for declaration at <strong>04:10 PM IST</strong>.</li>
          <li><strong>Second Round (SR):</strong> Scheduled for declaration at <strong>04:45 PM IST</strong>.</li>
          <li><strong>Venue:</strong> Khanapara, Ri-Bhoi District, Assam/Meghalaya Border.</li>
        </ul>

        {/* Section 4: Juwai Teer Results */}
        <h2>4. Juwai Teer Results</h2>
        <p>
          Held in Jowai, the district headquarters of West Jaintia Hills in Meghalaya, <strong>Juwai Teer</strong> is an early-afternoon competition that showcases the skilled marksmanship of local Jaintia archers. Due to its earlier time slot, it provides the first afternoon results of the day.
        </p>
        <ul>
          <li><strong>First Round (FR):</strong> Target verification completed at approximately <strong>02:05 PM IST</strong>.</li>
          <li><strong>Second Round (SR):</strong> Second round announced at approximately <strong>02:45 PM IST</strong>.</li>
          <li><strong>Venue:</strong> Jowai, West Jaintia Hills, Meghalaya.</li>
        </ul>

        {/* Section 5: Shillong Night Teer */}
        <h2>5. Shillong Night Teer Results</h2>
        <p>
          <strong>Shillong Night Teer</strong> was introduced to accommodate archery enthusiasts after regular daytime working hours. Held under floodlit conditions by licensed club marshals, the night sessions follow the identical scoring formulas as the afternoon editions.
        </p>
        <ul>
          <li><strong>First Round (FR):</strong> Announced at <strong>10:15 PM IST</strong>.</li>
          <li><strong>Second Round (SR):</strong> Announced at <strong>11:15 PM IST</strong>.</li>
          <li><strong>Venue:</strong> Authorized evening club grounds in Meghalaya.</li>
        </ul>

        {/* Section 6: Shillong Morning Teer */}
        <h2>6. Shillong Morning Teer Results</h2>
        <p>
          <strong>Shillong Morning Teer</strong> provides an early start to the daily archery calendar. Held in Shillong during morning hours, this session allows marksmen to participate before afternoon tournaments begin.
        </p>
        <ul>
          <li><strong>First Round (FR):</strong> Declared promptly at <strong>10:30 AM IST</strong>.</li>
          <li><strong>Second Round (SR):</strong> Declared at <strong>11:30 AM IST</strong>.</li>
          <li><strong>Schedule:</strong> Operates Monday through Saturday in Indian Standard Time.</li>
        </ul>

        {/* Section 7: Welcome Morning Teer */}
        <h2>7. Welcome Morning Teer Results</h2>
        <p>
          <strong>Welcome Morning Teer</strong> is an authorized morning competition conducted across the border clubs. Like Shillong Morning Teer, it offers morning enthusiasts two rounds of verified traditional archery tallies.
        </p>
        <ul>
          <li><strong>First Round (FR):</strong> Target count declared at <strong>10:30 AM IST</strong>.</li>
          <li><strong>Second Round (SR):</strong> Concluding round declared at <strong>11:30 AM IST</strong>.</li>
          <li><strong>Venue:</strong> Authorized morning club grounds, Meghalaya/Assam border.</li>
        </ul>

        {/* Section 8: FR vs SR */}
        <h2>8. FR vs SR — Understanding the Two Rounds</h2>
        <p>
          Every authorized Teer competition is structured into two distinct sessions:
        </p>
        <ul>
          <li><strong>First Round (FR):</strong> Archers shoot an allocated quantity of arrows (typically 30 per archer) within a strict time limit (usually 4 to 5 minutes). When the whistle blows, all shooting stops. Target marshals collect the arrows embedded in the cylindrical straw target, sort them into bundles of ten, and count the total. The <em>last two digits</em> of this total represent the official FR score. For example, if 842 arrows hit the target, the declared FR number is <strong>42</strong>.</li>
          <li><strong>Second Round (SR):</strong> Following a designated rest period, archers participate in the second session, shooting a smaller allotment of arrows (typically 20 per archer). The same counting procedure is repeated, and the last two digits of the second count form the SR score. If 509 arrows hit the target, the declared SR number is <strong>09</strong>.</li>
        </ul>

        {/* Section 9: How to Check Today's Teer Results */}
        <h2>9. How to Check Today&apos;s Teer Results</h2>
        <p>
          Checking live results on TeerResult24 is straightforward and designed for mobile and desktop screens:
        </p>
        <ol>
          <li>Navigate to the homepage where all six competition cards are arranged systematically.</li>
          <li>Verify the current date displayed in the header badge (always formatted in Indian Standard Time).</li>
          <li>Look for the status badges on each card: <strong>LIVE</strong> indicates confirmed declared scores, <strong>1st Round Declared</strong> shows FR is declared while SR is pending, and <strong>Awaiting Result</strong> indicates shooting has not concluded.</li>
          <li>Use the <strong>↻ Refresh Results</strong> button to pull the latest published database records without refreshing your browser page.</li>
          <li>Click <strong>Game Details</strong> on any card to access detailed club information, daily schedules, and 30-day historical score sheets.</li>
        </ol>

        {/* Section 10: Today's and Yesterday's Results */}
        <h2>10. Today&apos;s and Yesterday&apos;s Results</h2>
        <p>
          To maintain context between consecutive days, TeerResult24 provides both real-time today cards and a dedicated <em>Yesterday&apos;s Declared Results</em> overview. Reviewing yesterday&apos;s finalized outcomes assists analytical enthusiasts in studying statistical number frequencies, consecutive pairs, and house/ending patterns across different archery grounds.
        </p>

        {/* Section 11: Previous Results and Historical Archive */}
        <h2>11. Previous Results and Historical Archive</h2>
        <p>
          Our searchable <Link href="/previous-results/" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>Previous Results</Link> archive stores verified historical records across all six competitions. Users can filter past winning numbers by specific calendar dates or individual clubs. Historical data is preserved with absolute mathematical fidelity, ensuring leading zeros (such as 00, 01, 07) remain intact rather than being truncated into single digits.
        </p>

        {/* Section 12: Result Verification and Correction Policy */}
        <h2>12. Result Verification and Correction Policy</h2>
        <p>
          Accuracy and transparency are the foundational principles of TeerResult24. Every outcome displayed on our platform is cross-referenced with authorized ground announcements or verified score bulletins.
        </p>
        <ul>
          <li><strong>Multi-tier Verification:</strong> Incoming scores must be reviewed and approved through our authenticated administrative dashboard before being labeled with the verified badge.</li>
          <li><strong>Transparent Audit Log:</strong> In the rare event that an official association issues a recount or bulletin correction, our system records the modification in a public <Link href="/correction-policy/" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>Correction Log</Link>, noting the prior number, corrected score, reason, timestamp, and editor identity.</li>
          <li><strong>No Fictitious Estimates:</strong> We strictly prohibit publishing estimated numbers or unverified hearsay. If a round is delayed due to weather or counting procedures, our status badge clearly reflects &quot;Awaiting Result&quot; or &quot;Pending Review&quot;.</li>
        </ul>

        {/* Section 13: Frequently Asked Questions */}
        <h2>13. Frequently Asked Questions (FAQ)</h2>
        <div style={{ display: 'grid', gap: '16px', marginTop: '16px' }}>
          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              What time are Shillong Morning and Welcome Morning results declared?
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Both Shillong Morning Teer and Welcome Morning Teer declare their First Round (FR) at 10:30 AM IST and their Second Round (SR) at 11:30 AM IST, Monday through Saturday.
            </p>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              Why do Teer results include leading zeros like 04 or 09?
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Teer scores are derived from the last two digits of total arrow counts. When the tens digit is zero (e.g. 504 arrows), the official score is 04. Preserving the leading zero is mathematically essential for number accuracy.
            </p>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              Are Teer archery matches held on Sundays?
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              No. Sanctioned traditional archery matches in Meghalaya and Assam take place Monday through Saturday only. Sunday is an official rest day with no competitions.
            </p>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              How does the live refresh button work?
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              The ↻ Refresh button initiates a real-time request to our edge API endpoint with cache-busting headers, retrieving the most recent verified results stored in our PostgreSQL database without needing a full page reload.
            </p>
          </div>

          <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
              What is the legal status of traditional archery in Meghalaya?
            </h3>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Traditional archery is an indigenous cultural sport organized under the regulatory provisions of the Meghalaya Amusements and Betting Tax (Amendment) Act 1982. TeerResult24 operates strictly as an independent journalistic and informational record-keeper.
            </p>
          </div>
        </div>
      </article>

      <GameQuickLinks />

      {/* Structured Data (JSON-LD) for Search Engines */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'TeerResult24',
              url: 'https://teerresult24.com/',
              description: 'Verified daily archery results for Shillong, Khanapara, Juwai, Morning, and Night Teer.',
              potentialAction: {
                '@type': 'SearchAction',
                target: 'https://teerresult24.com/previous-results/?date={search_term_string}',
                'query-input': 'required name=search_term_string',
              },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'TeerResult24',
              url: 'https://teerresult24.com/',
              logo: 'https://teerresult24.com/icon.svg',
              description:
                'Independent daily archery results, historical archive, and dream numbers portal for Meghalaya Teer competitions.',
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'Customer Support',
                url: 'https://teerresult24.com/contact/',
              },
            },
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: [
                {
                  '@type': 'Question',
                  name: 'What time are Shillong Morning and Welcome Morning results declared?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Both Shillong Morning Teer and Welcome Morning Teer declare their First Round (FR) at 10:30 AM IST and their Second Round (SR) at 11:30 AM IST, Monday through Saturday.',
                  },
                },
                {
                  '@type': 'Question',
                  name: 'What does FR and SR mean in Teer results?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'FR stands for First Round (the first shooting session of the day), while SR stands for Second Round (the follow-up session conducted after a brief intermission).',
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
                {
                  '@type': 'Question',
                  name: 'Why do Teer results include leading zeros like 04 or 09?',
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: 'Teer scores are derived from the last two digits of total arrow counts. When the tens digit is zero (e.g. 504 arrows), the official score is 04. Preserving the leading zero is mathematically essential for number accuracy.',
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