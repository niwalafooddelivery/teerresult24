import Link from 'next/link';

const ALL_GAMES = [
  {
    slug: 'shillong-teer',
    name: 'Shillong Teer',
    href: '/shillong-teer-result/',
    timing: 'FR 03:45 PM • SR 04:45 PM',
    location: 'Polo Grounds, Shillong',
  },
  {
    slug: 'khanapara-teer',
    name: 'Khanapara Teer',
    href: '/khanapara-teer-result/',
    timing: 'FR 04:10 PM • SR 04:45 PM',
    location: 'Guwahati / Ri-Bhoi Border',
  },
  {
    slug: 'juwai-teer',
    name: 'Juwai Teer',
    href: '/juwai-teer-result/',
    timing: 'FR 02:00 PM • SR 02:45 PM',
    location: 'West Jaintia Hills, Jowai',
  },
  {
    slug: 'shillong-night-teer',
    name: 'Shillong Night Teer',
    href: '/shillong-night-teer/',
    timing: 'FR 10:15 PM • SR 11:15 PM',
    location: 'Night Session, Meghalaya',
  },
  {
    slug: 'shillong-morning-teer',
    name: 'Shillong Morning Teer',
    href: '/shillong-morning-teer-result/',
    timing: 'FR 10:30 AM • SR 11:30 AM',
    location: 'Morning Session, Shillong',
  },
  {
    slug: 'welcome-morning-teer',
    name: 'Welcome Morning Teer',
    href: '/welcome-morning-teer-result/',
    timing: 'FR 10:30 AM • SR 11:30 AM',
    location: 'Morning Archery Club, Meghalaya/Assam Border',
  },
];

export default function GameQuickLinks({ currentSlug = '', title = 'Explore Other Traditional Archery Competitions' }) {
  const otherGames = ALL_GAMES.filter((g) => g.slug !== currentSlug);

  return (
    <section style={{ margin: '36px 0 24px' }}>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
        {title}
      </h2>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
        Direct links to daily first round and second round outcomes across Meghalaya and Assam
      </p>

      <div className="game-quicklinks-grid">
        {otherGames.map((game) => (
          <Link key={game.slug} href={game.href} className="game-quicklink-card">
            <span className="game-quicklink-title">{game.name} &rarr;</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{game.timing}</span>
            <span className="game-quicklink-desc">{game.location}</span>
          </Link>
        ))}

        <Link href="/previous-results/" className="game-quicklink-card" style={{ background: 'var(--bg-primary)', borderStyle: 'dashed' }}>
          <span className="game-quicklink-title" style={{ color: 'var(--text-main)' }}>Historical Records Archive &rarr;</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Filter past dates &amp; clubs</span>
          <span className="game-quicklink-desc">All verified winning scores (00 to 99)</span>
        </Link>
      </div>
    </section>
  );
}
