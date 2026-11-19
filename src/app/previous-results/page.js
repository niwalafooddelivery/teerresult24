import prisma from '@/lib/prisma';
import PreviousResultsTable from '@/components/PreviousResultsTable';
import Link from 'next/link';

export const revalidate = 120;

export const metadata = {
  title: 'Teer Previous Results – Date-Wise History | TeerResult',
  description:
    'Search and browse comprehensive past Teer results for Shillong, Khanapara, Juwai, and Night Teer. Filter by game and date with leading zeros preserved on TeerResult.',
  alternates: {
    canonical: 'https://teerresult24.com/previous-results/',
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

  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <nav style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link href="/">Home</Link> &gt; <span>Previous Results</span>
      </nav>

      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Teer Previous Results – Date-Wise History</h1>
        <p className="hero-subtitle">
          Verified historical outcomes for Shillong Teer, Khanapara Teer, Juwai Teer, and Shillong Night Teer. Filter by game and date.
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
          Enthusiasts and cultural researchers regularly study past date-wise trends to observe arrow grouping distributions and historical outcome frequencies. Having access to a structured archive with First Round (FR) and Second Round (SR) scores enables transparent analysis across seasons and clubs.
        </p>

        <h3>Archive Quality Standards</h3>
        <ul>
          <li><strong>No Guesswork or Fabrication:</strong> Every entry is cross-checked against authorized ground declarations. Pending scores always show <code>--</code> until confirmed.</li>
          <li><strong>Timezone Standard:</strong> All dates and publication timestamps follow Indian Standard Time (IST / UTC+05:30).</li>
          <li><strong>Correction Transparency:</strong> In the rare event of an official scoring revision by the archery association, corrections are timestamped and logged in our audit records.</li>
        </ul>
      </article>
    </div>
  );
}
