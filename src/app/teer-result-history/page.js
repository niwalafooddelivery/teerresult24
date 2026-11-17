import prisma from '@/lib/prisma';
import PreviousResultsTable from '@/components/PreviousResultsTable';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Teer Result History - Multi-Year Archery Record Search | TeerResult',
  description:
    'Search multi-year historical Teer result databases. Filter by custom date ranges and game categories on TeerResult.',
  alternates: {
    canonical: 'https://teerresult24.com/teer-result-history/',
  },
};

export default async function TeerResultHistoryPage() {
  let categories = [];
  let totalCount = 0;
  let history = [];

  try {
    const res = await Promise.all([
      prisma.gameCategory.findMany({
        where: { isActive: true },
        orderBy: { order: 'asc' },
      }),
      prisma.teerResult.count(),
      prisma.teerResult.findMany({
        orderBy: [
          { dateStr: 'desc' },
          { category: { order: 'asc' } },
        ],
        take: 25,
        include: {
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
      }),
    ]);
    categories = res[0];
    totalCount = res[1];
    history = res[2];
  } catch (err) {
    console.warn('[TeerResultHistoryPage] Database unavailable:', err.message || err);
    categories = [
      { id: '1', name: 'Shillong Teer', slug: 'shillong-teer' },
      { id: '2', name: 'Khanapara Teer', slug: 'khanapara-teer' },
      { id: '3', name: 'Juwai Teer', slug: 'juwai-teer' },
      { id: '4', name: 'Shillong Night Teer', slug: 'shillong-night-teer' },
    ];
  }

  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <nav style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link href="/">Home</Link> &gt; <span>Teer Result History</span>
      </nav>

      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Teer Result History &amp; Record Search</h1>
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
      </article>
    </div>
  );
}
