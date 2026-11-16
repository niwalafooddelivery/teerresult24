import Link from 'next/link';

export const metadata = {
  title: 'About Us - Independent Archery Information Platform | TeerResult2',
  description:
    'Learn about TeerResult2, our mission to provide transparent, accurate, and prompt traditional Meghalaya archery outcome reporting and historical record keeping.',
  alternates: {
    canonical: 'https://teerresult2.com/about-us/',
  },
};

export default function AboutUsPage() {
  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <nav style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link href="/">Home</Link> &gt; <span>About Us</span>
      </nav>

      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">About TeerResult2</h1>
        <p className="hero-subtitle">
          An independent technical information and archival reference platform for traditional archery sports.
        </p>
      </section>

      <article className="seo-article">
        <h2>Our Mission</h2>
        <p>
          TeerResult2 was established with a singular objective: to deliver fast, transparent, and strictly verified outcomes for traditional archery competitions held across Meghalaya and neighboring border grounds.
        </p>
        <p>
          In a digital landscape often crowded with speculative predictions, unverified rumors, and unauthorized gambling promotions, TeerResult2 operates strictly as an independent journalistic and data-archiving portal.
        </p>

        <h2>Core Editorial Values</h2>
        <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
          <li>
            <strong>Factual Accuracy:</strong> We record scores directly from official bulletins published by licensed clubs, including the Khasi Hills Archery Sports Association (KHASA).
          </li>
          <li>
            <strong>Leading Zero Retention:</strong> Numbers below 10 are recorded with two-digit integrity (e.g. 04, 09), preserving official data formats.
          </li>
          <li>
            <strong>No Fictional Predictions:</strong> When a match has not concluded or arrows have not been counted, our platform displays &quot;--&quot; rather than synthetic estimates.
          </li>
          <li>
            <strong>Transparent Corrections:</strong> Should an official recount occur, revisions are logged openly in our public audit record.
          </li>
        </ul>

        <h2>Compliance and Ethics</h2>
        <p>
          TeerResult2 is strictly an informational publication. We are not affiliated with, nor do we operate, any betting or lottery counters. We do not accept wagers, offer tips, or sell number guarantees. All information is provided for cultural interest and archival research.
        </p>
      </article>
    </div>
  );
}
