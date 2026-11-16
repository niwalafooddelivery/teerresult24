import Link from 'next/link';

export const metadata = {
  title: 'Contact Us - Editorial Desk & Discrepancy Reporting | TeerResult2',
  description:
    'Contact the TeerResult2 editorial team for data inquiries, correction reports, and factual feedback regarding Meghalaya archery outcome reporting.',
  alternates: {
    canonical: 'https://teerresult2.com/contact/',
  },
};

export default function ContactPage() {
  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <nav style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link href="/">Home</Link> &gt; <span>Contact Us</span>
      </nav>

      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Contact Editorial Desk</h1>
        <p className="hero-subtitle">
          Inquiries, discrepancy submissions, and general editorial feedback.
        </p>
      </section>

      <article className="seo-article">
        <h2>Reporting Score Discrepancies</h2>
        <p>
          We take scoring accuracy seriously. If you notice any discrepancy between our published outcome and an official ground bulletin released at Polo Grounds Shillong, Khanapara, or Juwai, please reach out with corroborated details:
        </p>
        <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
          <li>Name of the archery match / session</li>
          <li>Date of competition (Asia/Kolkata timezone)</li>
          <li>Round number (First Round or Second Round)</li>
          <li>Corroborating official ground notice or bulletin reference</li>
        </ul>

        <h2>Direct Contact Channels</h2>
        <p>
          <strong>Email:</strong> editorial@teerresult2.com<br />
          <strong>Support Hours:</strong> Monday – Saturday, 10:00 AM – 11:30 PM IST<br />
          <strong>Response Time:</strong> Scoring discrepancy notices are typically investigated and processed within 15 to 30 minutes of official confirmation.
        </p>

        <h2>Correction Workflow</h2>
        <p>
          Learn more about our transparent audit process on our{' '}
          <Link href="/correction-policy/" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
            Correction Policy
          </Link>{' '}
          page.
        </p>
      </article>
    </div>
  );
}
