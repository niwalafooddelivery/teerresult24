import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';
import GameQuickLinks from '@/components/GameQuickLinks';

export const metadata = {
  title: 'What is Teer? Rules, History & Archery Calculation Guide | TeerResult',
  description:
    'Comprehensive guide explaining the traditional Khasi sport of Teer in Meghalaya, how arrows are shot and counted, official club rules, and score calculation.',
  alternates: {
    canonical: 'https://teerresult24.com/what-is-teer/',
  },
  openGraph: {
    title: 'What is Teer? Rules, History & Archery Calculation Guide | TeerResult',
    description:
      'Learn about Meghalaya traditional archery: regulations, arrow counting process, scoring formula, and daily competition schedule.',
    url: 'https://teerresult24.com/what-is-teer/',
    siteName: 'TeerResult',
    locale: 'en_IN',
    type: 'article',
  },
};

export default function WhatIsTeerPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is Teer in Meghalaya?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Teer is a traditional archery sport regulated under the Meghalaya Amusements and Betting Tax (Amendment) Act 1982, organized by the Khasi Hills Archery Sports Association (KHASA) in Shillong.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is the winning Teer number calculated?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Archers shoot at a target cylinder. Officials pull and count all hitting arrows. The last two digits of the total count determine the winning score (e.g. 742 arrows = 42; 809 arrows = 09).',
        },
      },
      {
        '@type': 'Question',
        name: 'What days are Teer matches conducted?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Sanctioned Teer archery matches take place Monday through Saturday. Matches are suspended on Sundays and state public holidays.',
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

      <Breadcrumb items={[{ label: 'What is Teer' }]} />

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
          <li><strong>First Round (FR):</strong> Fifty archers shoot 30 arrows each within 5 minutes. The round takes place around 03:45 PM IST.</li>
          <li><strong>Second Round (SR):</strong> The concluding round allows 20 arrows each within 3 minutes around 04:30 PM to 04:45 PM IST.</li>
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
          <table className="history-table" style={{ margin: '20px 0' }} aria-label="Key Teer Archery Match Timings">
            <thead>
              <tr>
                <th scope="col">Game Name</th>
                <th scope="col">Location</th>
                <th scope="col">1st Round Time (FR)</th>
                <th scope="col">2nd Round Time (SR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><Link href="/juwai-teer-result/"><strong>Juwai Teer</strong></Link></td>
                <td>West Jaintia Hills</td>
                <td>02:00 PM IST</td>
                <td>02:45 PM IST</td>
              </tr>
              <tr>
                <td><Link href="/shillong-teer-result/"><strong>Shillong Teer</strong></Link></td>
                <td>Polo Grounds, Shillong</td>
                <td>03:45 PM IST</td>
                <td>04:30 PM IST</td>
              </tr>
              <tr>
                <td><Link href="/khanapara-teer-result/"><strong>Khanapara Teer</strong></Link></td>
                <td>Ri-Bhoi Border</td>
                <td>04:10 PM IST</td>
                <td>04:45 PM IST</td>
              </tr>
              <tr>
                <td><Link href="/shillong-night-teer/"><strong>Shillong Night Teer</strong></Link></td>
                <td>Shillong (Night Session)</td>
                <td>10:30 PM IST</td>
                <td>11:30 PM IST</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <GameQuickLinks />
    </div>
  );
}
