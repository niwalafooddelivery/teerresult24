import prisma from '@/lib/prisma';
import PreviousResultsTable from '@/components/PreviousResultsTable';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';
import GameQuickLinks from '@/components/GameQuickLinks';

export const revalidate = 120;

export const metadata = {
  title: 'Teer Result History – Search Multi-Year Records | TeerResult',
  description:
    'Search multi-year historical Teer results with date-wise records for Shillong, Khanapara, Juwai, and Night Teer. Filter by date and club on TeerResult.',
  alternates: {
    canonical: 'https://teerresult24.com/teer-result-history/',
  },
  openGraph: {
    title: 'Teer Result History – Search Multi-Year Records | TeerResult',
    description:
      'Search verified past archery competition results across all recognized Meghalaya and Assam clubs.',
    url: 'https://teerresult24.com/teer-result-history/',
    siteName: 'TeerResult',
    locale: 'en_IN',
    type: 'website',
  },
};

export default async function TeerResultHistoryPage() {
  let categories = [];
  let totalCount = 0;
  let history = [];

  try {
    categories = await prisma.gameCategory.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        order: true,
      },
      orderBy: { order: 'asc' },
    });
  } catch (err) {
    console.warn('[TeerResultHistoryPage] Category query failed, using fallback:', err.message || err);
    categories = [
      { id: 'shillong-teer', name: 'Shillong Teer', slug: 'shillong-teer' },
      { id: 'khanapara-teer', name: 'Khanapara Teer', slug: 'khanapara-teer' },
      { id: 'juwai-teer', name: 'Juwai Teer', slug: 'juwai-teer' },
      { id: 'shillong-night-teer', name: 'Shillong Night Teer', slug: 'shillong-night-teer' },
    ];
  }

  try {
    history = await prisma.teerResult.findMany({
      orderBy: { dateStr: 'desc' },
      take: 25,
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
  } catch (err) {
    console.warn('[TeerResultHistoryPage] History query failed:', err.message || err);
    history = [];
  }

  try {
    totalCount = await prisma.teerResult.count();
  } catch (err) {
    totalCount = history.length;
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How can I search Teer result history by date?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Use the interactive date picker and game filter on this page to search any date range or specific archery session in our multi-year database.',
        },
      },
      {
        '@type': 'Question',
        name: 'Are leading zeros preserved in historical Teer scores?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Every historical score strictly preserves the 2-digit format (00 to 99) as officially declared at the archery grounds.',
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

      <Breadcrumb items={[{ label: 'Teer Result History' }]} />

      {/* Target Keyword H1: Teer Result History */}
      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Teer Result History</h1>
        <p className="hero-subtitle">
          Search verified past archery competition results across all recognized Meghalaya and Assam clubs.
        </p>
      </section>

      <PreviousResultsTable
        initialResults={history}
        categories={categories}
        initialTotalCount={totalCount}
        initialPage={1}
        initialLimit={25}
        initialTotalPages={Math.max(1, Math.ceil(totalCount / 25))}
      />

      <article className="seo-article" style={{ marginTop: '36px' }}>
        <h2>Historical Records &amp; Data Provenance</h2>
        <p>
          The TeerResult archival database preserves date-wise archery scores from sanctioned grounds including Polo Grounds Shillong, Khanapara, and Jowai. All historical entries enforce two-digit notation with leading zero preservation (e.g. 02, 08).
        </p>
        <p>
          Whether studying long-term historical frequencies or checking yesterday&apos;s scores, explore our targeted game hubs for{' '}
          <Link href="/shillong-teer-result/">Shillong Teer Result Today</Link>,{' '}
          <Link href="/khanapara-teer-result/">Khanapara Teer Result</Link>,{' '}
          <Link href="/juwai-teer-result/">Juwai Teer Result Today</Link>, and{' '}
          <Link href="/shillong-night-teer/">Shillong Night Teer Result</Link>.
        </p>
      </article>

      <GameQuickLinks />
    </div>
  );
}
