import Link from 'next/link';

export default function Breadcrumb({ items = [] }) {
  const fullItems = [
    { label: 'Home', href: '/' },
    ...items,
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: fullItems.map((item, index) => {
      const position = index + 1;
      const element = {
        '@type': 'ListItem',
        position,
        name: item.label,
      };
      if (item.href) {
        element.item = item.href.startsWith('http')
          ? item.href
          : `https://teerresult24.com${item.href}`;
      }
      return element;
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="breadcrumb-nav">
        <ol className="breadcrumb-list">
          {fullItems.map((item, idx) => {
            const isLast = idx === fullItems.length - 1;
            return (
              <li key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                {idx > 0 && <span className="breadcrumb-separator" aria-hidden="true">&gt;</span>}
                {isLast || !item.href ? (
                  <span className="breadcrumb-current" aria-current="page">
                    {item.label}
                  </span>
                ) : (
                  <Link href={item.href}>{item.label}</Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
