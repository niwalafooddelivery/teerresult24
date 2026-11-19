import prisma from '@/lib/prisma';
import PreviousResultsTable from '@/components/PreviousResultsTable';
import Link from 'next/link';
import Breadcrumb from '@/components/Breadcrumb';
import GameQuickLinks from '@/components/GameQuickLinks';

export const revalidate = 120;

export const metadata = {
  title: 'Teer Previous Results – Date-Wise Archery Archive | TeerResult',
  description:
    'Browse Teer Previous Results date-wise for Shillong, Khanapara, Juwai, and Shillong Night. Complete archery archive with verified first round and second round scores.',
  alternates: {
    canonical: 'https://teerresult24.com/previous-results/',
  },
  openGraph: {
    title: 'Teer Previous Results – Date-Wise Archery Archive | TeerResult',
    description:
      'Search and browse verified historical Teer results date-wise across all major Meghalaya archery sessions.',
    url: 'https://teerresult24.com/previous-results/',
    siteName: 'TeerResult',
    locale: 'en_IN',
    type: 'website',
  },
};

export default async function PreviousResultsPage() {
  let categories = [];
  let totalCount = 0;
  let allHistory = [];

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
    console.warn('[PreviousResultsPage] Category query failed, using fallback:', err.message || err);
    categories = [
      { id: 'shillong-teer', name: 'Shillong Teer', slug: 'shillong-teer' },
      { id: 'khanapara-teer', name: 'Khanapara Teer', slug: 'khanapara-teer' },
      { id: 'juwai-teer', name: 'Juwai Teer', slug: 'juwai-teer' },
      { id: 'shillong-night-teer', name: 'Shillong Night Teer', slug: 'shillong-night-teer' },
    ];
  }

  try {
    allHistory = await prisma.teerResult.findMany({
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
    console.warn('[PreviousResultsPage] History query failed:', err.message || err);
    allHistory = [];
  }

  try {
    totalCount = await prisma.teerResult.count();
  } catch (err) {
    totalCount = allHistory.length;
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Where can I find Teer previous results?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'TeerResult maintains a complete date-wise archive of previous Teer results for Shillong, Khanapara, Juwai, and Shillong Night, with First Round (FR) and Second Round (SR) scores preserved with leading zeros.',
        },
      },
      {
        '@type': 'Question',
        name: 'Are all previous Teer results verified?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. All historical records are matched against authorized archery club score tally sheets. We never publish speculative or unverified entries.',
        },
      },
      {
        '@type': 'Question',
        name: 'How far back does the Teer results archive go?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Our searchable database covers recent months and multi-year historical logs, updated daily following each confirmed match.',
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

      <Breadcrumb items={[{ label: 'Teer Previous Results' }]} />

      {/* Target Keyword H1: Teer Previous Results */}
      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Teer Previous Results</h1>
        <p className="hero-subtitle">
          Verified historical archery outcomes for Shillong Teer, Khanapara Teer, Juwai Teer, and Shillong Night Teer. Filter by game and date.
        </p>
      </section>

      <PreviousResultsTable
        initialResults={allHistory}
        categories={categories}
        initialTotalCount={totalCount}
        initialPage={1}
        initialLimit={25}
        initialTotalPages={Math.max(1, Math.ceil(totalCount / 25))}
      />

      <article className="seo-article" style={{ marginTop: '40px' }}>
        <h2>Complete Archival Records and Verification Integrity</h2>
        <p>
          Historical archery records on TeerResult are maintained with strict technical accuracy. Unlike casual scoreboards that truncate single digits (such as writing &quot;4&quot; instead of &quot;04&quot;), our database enforces exact two-digit notation (00 to 99). This guarantees that every record accurately matches the official archery bulletins recorded at Polo Grounds Shillong, Khanapara Guwahati, and Juwai Jaintia Hills.
        </p>

        <h3>Why Date-Wise Historical Analysis Matters</h3>
        <p>
          Enthusiasts and cultural researchers regularly study past date-wise trends to observe arrow grouping distributions and historical outcome frequencies. Having access to a structured archive with First Round (FR) and Second Round (SR) scores enables transparent analysis across seasons and clubs. You can also explore traditional dream interpretations on our{' '}
          <Link href="/teer-dream-numbers/">Teer Dream Numbers</Link> directory or search multi-year logs in{' '}
          <Link href="/teer-result-history/">Teer Result History</Link>.
        </p>

        <h3>Archive Quality Standards</h3>
        <ul>
          <li><strong>No Guesswork or Fabrication:</strong> Every entry is cross-checked against authorized ground declarations. Pending scores always show <code>--</code> until confirmed.</li>
          <li><strong>Timezone Standard:</strong> All dates and publication timestamps follow Indian Standard Time (IST / UTC+05:30).</li>
          <li><strong>Correction Transparency:</strong> In the rare event of an official scoring revision by the archery association, corrections are timestamped and logged in our audit records.</li>
        </ul>
      </article>

      <GameQuickLinks />
    </div>
  );
}
