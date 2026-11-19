import Link from 'next/link';
import DreamSearchGrid from '@/components/DreamSearchGrid';
import Breadcrumb from '@/components/Breadcrumb';
import GameQuickLinks from '@/components/GameQuickLinks';

export const metadata = {
  title: 'Teer Dream Numbers – Traditional Meaning & Number Chart | TeerResult',
  description:
    'Search traditional Khasi archery dream interpretations. Find direct numbers, house, and ending digits for your dreams on TeerResult.',
  alternates: {
    canonical: 'https://teerresult24.com/teer-dream-numbers/',
  },
  openGraph: {
    title: 'Teer Dream Numbers – Traditional Meaning & Number Chart | TeerResult',
    description:
      'Search customary Khasi dream interpretations and traditional associations with archery target numbers on TeerResult.',
    url: 'https://teerresult24.com/teer-dream-numbers/',
    siteName: 'TeerResult',
    locale: 'en_IN',
    type: 'website',
  },
};

export default function TeerDreamNumbersPage() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What are Teer dream numbers?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Teer dream numbers are traditional associations originating in Khasi folklore where common dream imagery (such as snakes, flying, water, or vehicles) is linked to specific target numbers.',
        },
      },
      {
        '@type': 'Question',
        name: 'Are dream numbers guaranteed to win in Teer archery?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Teer archery results are determined strictly by the physical count of arrows hitting the target at authorized archery grounds. Dream interpretations are customary folklore preserved for cultural interest.',
        },
      },
      {
        '@type': 'Question',
        name: 'What are house and ending numbers in Teer?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'In regional Teer vocabulary, "house" refers to the tens digit of a two-digit score, while "ending" refers to the units digit (for example, in score 47, house is 4 and ending is 7).',
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

      <Breadcrumb items={[{ label: 'Teer Dream Numbers' }]} />

      {/* Target Keyword H1: Teer Dream Numbers */}
      <section className="hero-banner" style={{ padding: '16px 0 24px' }}>
        <h1 className="hero-title">Teer Dream Numbers</h1>
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

        <h3>Check Today&apos;s Declared Results</h3>
        <p>
          Compare your interpretations against today&apos;s actual verified ground scores:
        </p>
        <ul>
          <li><Link href="/shillong-teer-result/">Shillong Teer Result Today</Link> (03:45 PM &amp; 04:30 PM)</li>
          <li><Link href="/khanapara-teer-result/">Khanapara Teer Result</Link> (04:10 PM &amp; 04:45 PM)</li>
          <li><Link href="/juwai-teer-result/">Juwai Teer Result Today</Link> (02:00 PM &amp; 02:45 PM)</li>
          <li><Link href="/shillong-night-teer/">Shillong Night Teer Result</Link> (10:30 PM &amp; 11:30 PM)</li>
        </ul>

        <h3>Informational Disclaimer</h3>
        <p>
          Dream interpretations are preserved here purely for cultural, historical, and ethnographic appreciation. Archery scores in Meghalaya are exclusively determined by physical arrows hitting targets under official supervision, not by supernatural phenomena or dream predictions.
        </p>
      </article>

      <GameQuickLinks />
    </div>
  );
}
