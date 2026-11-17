import Link from 'next/link';
import DreamSearchGrid from '@/components/DreamSearchGrid';

export const metadata = {
  title: 'Teer Dream Numbers – Traditional Meanings & House Ending Chart | TeerResult',
  description:
    'Search traditional Khasi archery dream interpretations. Find direct numbers, house, and ending digits for your dreams on TeerResult.',
  alternates: {
    canonical: 'https://teerresult24.com/teer-dream-numbers/',
  },
};

export default function TeerDreamNumbersPage() {
  return (
    <div className="container" style={{ padding: '24px 20px 48px' }}>
      <nav style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        <Link href="/">Home</Link> &gt; <span>Dream Numbers</span>
      </nav>

      {/* Unique Exact H1 for Dream Numbers */}
      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Teer Dream Numbers – Traditional Meanings</h1>
        <p className="hero-subtitle">
          Explore customary Khasi dream interpretations and their traditional associations with archery target numbers.
        </p>
      </section>

      {/* Interactive Client-side Search and Dream Cards */}
      <DreamSearchGrid />

      {/* Educational Article on Dream Numbers Tradition */}
      <article className="seo-article">
        <h2>The Cultural Tradition of Teer Dream Interpretations</h2>
        <p>
          In Khasi cultural folklore, nighttime dreams have long been regarded as intuitive reflections of daily life. Over generations, archery followers in Shillong and surrounding hills established a customary lexicon connecting specific dream symbols with numbers.
        </p>

        <h3>How Symbols Connect to Numbers</h3>
        <p>
          Many associations stem from phonetic puns, linguistic similarities, or physical shapes in the Khasi language:
        </p>
        <ul>
          <li><strong>Serpent or Snake (Bsein):</strong> Because of its elongated S-shape and cultural symbolism, it is traditionally tied to number <strong>7</strong>.</li>
          <li><strong>Water or Rain (Um):</strong> Fluidity and four cardinal directions link water symbols to house <strong>4</strong>.</li>
          <li><strong>Fish (Dohkha):</strong> The Khasi word for fish often associates phonetically with the ending digit <strong>9</strong>.</li>
        </ul>

        <h3>Informational Disclaimer</h3>
        <p>
          Dream interpretations are preserved here purely for cultural, historical, and ethnographic appreciation. Archery scores in Meghalaya are exclusively determined by physical arrows hitting targets under official supervision, not by supernatural phenomena or dream predictions.
        </p>
      </article>
    </div>
  );
}
