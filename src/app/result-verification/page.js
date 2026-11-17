import Link from 'next/link';

export const metadata = {
  title: 'Result Verification Protocol - How We Validate Scores | TeerResult',
  description:
    'Detailed breakdown of how TeerResult verifies traditional archery scores from Polo Grounds Shillong, Khanapara, and Juwai before publishing.',
  alternates: {
    canonical: 'https://teerresult24.com/result-verification/',
  },
};

export default function ResultVerificationPage() {
  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <nav style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link href="/">Home</Link> &gt; <span>Result Verification</span>
      </nav>

      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Result Verification Protocol</h1>
        <p className="hero-subtitle">
          Our rigorous standards for transcribing, corroborating, and verifying archery outcomes.
        </p>
      </section>

      <article className="seo-article">
        <h2>Three-Tier Verification Standard</h2>
        <p>
          Unlike unverified social media channels or speculative rumor boards, TeerResult follows a structured validation protocol prior to marking any number as verified:
        </p>

        <h3>1. Direct Ground Bulletin Corroboration</h3>
        <p>
          Every declared outcome must originate from an official bulletin signed by field judges from authorized associations, such as the Khasi Hills Archery Sports Association (KHASA) at Polo Grounds Shillong or authorized club marshals in Khanapara and Jowai.
        </p>

        <h3>2. Two-Digit Numerical Validation</h3>
        <p>
          Every candidate score is validated by software to ensure it strictly conforms to a two-digit integer between <code>00</code> and <code>99</code>. Leading zeros (e.g., <code>04</code>, <code>09</code>) are strictly preserved to maintain chronological database consistency.
        </p>

        <h3>3. Source Evidence Documentation</h3>
        <p>
          Editorial entries require documented provenance—including field recorder notes, timestamped photograph of the ground announcement board, or public declaration tally sheet. Entries without verifiable evidence remain flagged as &quot;Pending Verification&quot;.
        </p>

        <h2>Status Indicators Explained</h2>
        <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
          <li>
            <strong>Verified Bulletin:</strong> The outcome has been fully corroborated by official ground declaration evidence.
          </li>
          <li>
            <strong>Pending Verification:</strong> Initial field report received but awaiting final corroboration before permanent archiving.
          </li>
          <li>
            <strong>Awaiting Result (--):</strong> The shooting session is upcoming or arrow counting has not yet concluded.
          </li>
        </ul>

        <h2>Discrepancy Resolution</h2>
        <p>
          If a scoring dispute arises at the ground, our editors hold publication until association marshals issue a formal resolution. Any adjustments are documented in our public{' '}
          <Link href="/correction-policy/" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>
            Correction Policy
          </Link>{' '}
          audit log.
        </p>
      </article>
    </div>
  );
}
