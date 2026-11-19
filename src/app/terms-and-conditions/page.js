import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';

export const metadata = {
  title: 'Terms and Conditions – User Agreement | TeerResult',
  description:
    'Terms of service, age restrictions (18+), and informational disclaimer governing the use of the TeerResult website.',
  alternates: {
    canonical: 'https://teerresult24.com/terms-and-conditions/',
  },
  openGraph: {
    title: 'Terms and Conditions – User Agreement | TeerResult',
    description:
      'Review terms of service, age restrictions (18+), and informational usage guidelines for TeerResult.',
    url: 'https://teerresult24.com/terms-and-conditions/',
    siteName: 'TeerResult',
    locale: 'en_IN',
    type: 'website',
  },
};

export default function TermsAndConditionsPage() {
  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <Breadcrumb items={[{ label: 'Terms and Conditions' }]} />

      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Terms and Conditions</h1>
        <p className="hero-subtitle">
          User agreement, age guidelines, and liability disclaimer for TeerResult.
        </p>
      </section>

      <article className="seo-article">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing and using <strong>TeerResult</strong> (accessible at https://teerresult24.com/), you agree to comply with and be bound by the following terms and conditions. If you disagree with any portion of these terms, please discontinue use of this site.
        </p>

        <h2>2. Strictly Informational and Educational Purpose</h2>
        <p>
          TeerResult is strictly an independent informational and statistical archive documenting traditional Meghalaya archery competitions. We do not organize, facilitate, conduct, or participate in wagering, lotteries, or monetary transactions.
        </p>

        <h2>3. Age Requirement (18+)</h2>
        <p>
          This website is intended exclusively for individuals aged 18 and older. If you are under 18 years of age, you are prohibited from utilizing this platform.
        </p>

        <h2>4. No Warranty on Historical Forecasting</h2>
        <p>
          While we strive for 100% accuracy in transcribing official ground notices, traditional archery outcomes are determined by physical sport. TeerResult makes no claims, warranties, or guarantees regarding future match outcomes.
        </p>

        <h2>5. Intellectual Property</h2>
        <p>
          Original editorial content, data visualizations, and software design on TeerResult are protected by copyright. Unauthorized reproduction or scraping without explicit attribution is prohibited.
        </p>
      </article>
    </div>
  );
}
