import Link from 'next/link';

export const metadata = {
  title: 'What is Teer? Rules, History & Archery Calculation Guide | TeerResult2',
  description:
    'Comprehensive guide explaining the traditional Khasi sport of Teer in Meghalaya, how arrows are shot and counted, official club rules, and score calculation.',
  alternates: {
    canonical: 'https://teerresult2.com/what-is-teer/',
  },
};

export default function WhatIsTeerPage() {
  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <nav style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link href="/">Home</Link> &gt; <span>What is Teer</span>
      </nav>

      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">What is Teer? Rules, History &amp; Scoring Explained</h1>
        <p className="hero-subtitle">
          An in-depth informational guide to the traditional archery sport of Meghalaya.
        </p>
      </section>

      <article className="seo-article">
        <h2>Origins of the Traditional Archery Sport</h2>
        <p>
          Teer (derived from the traditional word for arrow, locally associated with customary Khasi archery) is a traditional sporting and recreational activity practiced in the northeastern Indian state of Meghalaya. The practice has deep cultural roots among the indigenous Khasi community, where proficiency in traditional archery has been passed down through generations.
        </p>

        <h2>Legal Framework &amp; Regulatory Oversight</h2>
        <p>
          Unlike unauthorized wagering activities, traditional Teer in Meghalaya is formally recognized and regulated under the <em>Meghalaya Amusements and Betting Tax (Amendment) Act 1982</em>. Competitions are coordinated by the Khasi Hills Archery Sports Association (KHASA), an umbrella organization composed of 12 registered indigenous archery clubs headquartered in Shillong.
        </p>

        <h2>How the Competition is Conducted</h2>
        <p>
          Every afternoon from Monday to Saturday, archers gather at the designated shooting grounds at Polo Grounds, Shillong. The target consists of a tightly wrapped bundle of cane cylinders set approximately 50 meters away from the shooting stand.
        </p>
        <p>
          The competition is split into two distinct rounds:
        </p>
        <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
          <li><strong>First Round (FR):</strong> Fifty archers shoot 30 arrows each within 5 minutes. The round takes place at 03:45 PM IST.</li>
          <li><strong>Second Round (SR):</strong> The concluding round allows 20 arrows each within 3 minutes at 04:45 PM IST.</li>
        </ul>

        <h2>How the Declared Score is Determined</h2>
        <p>
          Once shooting ends, authorized field judges inspect the target and pull out all arrows that successfully struck the cylinder. The arrows are counted in bundles of ten before representatives and spectators.
        </p>
        <p>
          The final declared number is strictly the <strong>last two digits</strong> of the verified arrow count:
        </p>
        <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
          <li>If the First Round arrow count totals <strong>842</strong>, the winning result is <strong>42</strong>.</li>
          <li>If the Second Round arrow count totals <strong>709</strong>, the winning result is <strong>09</strong> (leading zero preserved).</li>
        </ul>

        <h2>Key Announcement Timings</h2>
        <div className="table-responsive">
          <table className="history-table" style={{ margin: '20px 0' }}>
            <thead>
              <tr>
                <th>Game Name</th>
                <th>Location</th>
                <th>1st Round Time (FR)</th>
                <th>2nd Round Time (SR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Juwai Teer</strong></td>
                <td>West Jaintia Hills</td>
                <td>02:05 PM IST</td>
                <td>02:45 PM IST</td>
              </tr>
              <tr>
                <td><strong>Shillong Teer</strong></td>
                <td>Polo Grounds, Shillong</td>
                <td>03:45 PM IST</td>
                <td>04:45 PM IST</td>
              </tr>
              <tr>
                <td><strong>Khanapara Teer</strong></td>
                <td>Ri-Bhoi Border</td>
                <td>04:10 PM IST</td>
                <td>04:45 PM IST</td>
              </tr>
              <tr>
                <td><strong>Shillong Night Teer</strong></td>
                <td>Shillong (Night Session)</td>
                <td>10:15 PM IST</td>
                <td>11:15 PM IST</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
