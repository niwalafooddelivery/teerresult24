import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy - User Data & Cookies Notice | TeerResult2',
  description:
    'Our privacy statement explaining minimal data collection, cookies usage for session preferences, and privacy practices on TeerResult2.',
  alternates: {
    canonical: 'https://teerresult2.com/privacy-policy/',
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <nav style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link href="/">Home</Link> &gt; <span>Privacy Policy</span>
      </nav>

      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Privacy Policy</h1>
        <p className="hero-subtitle">
          How TeerResult2 handles visitor data, analytics, and browser cookies.
        </p>
      </section>

      <article className="seo-article">
        <h2>1. Information We Collect</h2>
        <p>
          TeerResult2 is an open informational website. Visitors are not required to create an account or provide personal identifying information to browse live results, dream charts, or historical archives.
        </p>
        <p>
          Standard non-personally identifiable server logs (such as IP address, browser type, referring page, and operating system) may be automatically gathered to monitor platform performance and prevent malicious automated abuse.
        </p>

        <h2>2. Cookies and Local Storage</h2>
        <p>
          We use functional cookies and local browser storage strictly for essential user preferences (such as remembering active theme settings or caching archive queries) and session security on administrative login endpoints. We do not sell user data to advertising brokers.
        </p>

        <h2>3. Third-Party Links</h2>
        <p>
          Our pages may contain links to external cultural or state documentation resources. TeerResult2 has no control over the privacy policies or practices of third-party websites.
        </p>

        <h2>4. Policy Updates</h2>
        <p>
          Any revisions to this privacy statement will be updated on this page with an updated modification timestamp.
        </p>
      </article>
    </div>
  );
}
