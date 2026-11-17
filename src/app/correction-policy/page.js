import prisma from '@/lib/prisma';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Correction Policy - Archery Score Audit & Transparency | TeerResult',
  description:
    'Our transparent policy and public audit log for correcting verified archery records, official recounts, and bulletin discrepancies on TeerResult.',
  alternates: {
    canonical: 'https://teerresult24.com/correction-policy/',
  },
};

export default async function CorrectionPolicyPage() {
  let recentCorrections = [];
  try {
    recentCorrections = await prisma.correctionLog.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        result: {
          include: {
            category: true,
          },
        },
      },
    });
  } catch (err) {
    console.warn('[CorrectionPolicyPage] Database unavailable:', err.message || err);
    recentCorrections = [];
  }

  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <nav style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link href="/">Home</Link> &gt; <span>Correction Policy</span>
      </nav>

      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Editorial Correction Policy</h1>
        <p className="hero-subtitle">
          How TeerResult ensures data accuracy, investigates discrepancies, and maintains a public audit log.
        </p>
      </section>

      <article className="seo-article">
        <h2>Commitment to Data Integrity</h2>
        <p>
          At TeerResult, we prioritize speed, but never at the expense of verified precision. Every archery outcome published on our platform is cross-referenced with authorized ground bulletins and verified field observers.
        </p>
        <p>
          On rare occasions, official organizing bodies—such as the Khasi Hills Archery Sports Association—may conduct a recount due to disputed arrows or clerical misreporting during initial verbal announcements. When an official revision occurs:
        </p>
        <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
          <li>We update the published figure immediately upon verification.</li>
          <li>We log the original number, the revised number, the time of correction, and the official justification.</li>
          <li>We maintain this log publicly to ensure accountability for historical research.</li>
        </ul>

        <h2>Recent Audit Corrections</h2>
        {recentCorrections.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No recent score corrections have been logged. All historical records match official ground bulletins.
          </p>
        ) : (
          <div className="data-table-container" style={{ margin: '20px 0' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>Game</th>
                  <th>Round</th>
                  <th>Original Value</th>
                  <th>Corrected Value</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {recentCorrections.map((c) => (
                  <tr key={c.id}>
                    <td>{new Date(c.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
                    <td style={{ fontWeight: 700 }}>{c.result?.category?.name || 'Teer Game'}</td>
                    <td>Round {c.roundNumber}</td>
                    <td style={{ color: 'var(--text-dim)' }}>{c.oldValue || '--'}</td>
                    <td style={{ color: 'var(--emerald-600)', fontWeight: 800 }}>{c.newValue}</td>
                    <td style={{ fontSize: '0.82rem' }}>{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <h2>Reporting a Discrepancy</h2>
        <p>
          If you identify any inconsistency between our published score and an official ground bulletin, please notify our editorial desk immediately via our <Link href="/contact/" style={{ color: 'var(--primary-color)', fontWeight: 600 }}>Contact Page</Link>. Include the game, date, round, and corroborating field evidence.
        </p>
      </article>
    </div>
  );
}
