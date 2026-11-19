import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';
import GameQuickLinks from '@/components/GameQuickLinks';

export const metadata = {
  title: 'About Us – Independent Archery Information Platform | TeerResult',
  description:
    'Learn about TeerResult, our mission to provide transparent, accurate, and prompt traditional Meghalaya archery outcome reporting and historical record keeping.',
  alternates: {
    canonical: 'https://teerresult24.com/about-us/',
  },
  openGraph: {
    title: 'About Us – Independent Archery Information Platform | TeerResult',
    description:
      'Learn about TeerResult: our mission, editorial standards, and commitment to accurate Meghalaya archery reporting.',
    url: 'https://teerresult24.com/about-us/',
    siteName: 'TeerResult',
    locale: 'en_IN',
    type: 'website',
  },
};

export default function AboutUsPage() {
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'TeerResult',
    url: 'https://teerresult24.com/',
    logo: 'https://teerresult24.com/icon.svg',
    description:
      'Independent archival and informational portal documenting traditional Khasi and Meghalaya archery competitions with strict verification.',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'Customer Support',
      url: 'https://teerresult24.com/contact/',
    },
  };

  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
      />

      <Breadcrumb items={[{ label: 'About Us' }]} />

      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">About TeerResult</h1>
        <p className="hero-subtitle">
          An independent technical information and archival reference platform for traditional archery sports.
        </p>
      </section>

      <article className="seo-article">
        <h2>Our Mission</h2>
        <p>
          TeerResult was established with a singular objective: to deliver fast, transparent, and strictly verified outcomes for traditional archery competitions held across Meghalaya and neighboring border grounds.
        </p>
        <p>
          In a digital landscape often crowded with speculative predictions, unverified rumors, and unauthorized gambling promotions, TeerResult operates strictly as an independent journalistic and data-archiving portal.
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
          TeerResult is strictly an informational publication. We are not affiliated with, nor do we operate, any betting or lottery counters. We do not accept wagers, offer tips, or sell number guarantees. All information is provided for cultural interest and archival research.
        </p>
      </article>

      <GameQuickLinks />
    </div>
  );
}
