export default function sitemap() {
  const baseUrl = 'https://teerresult2.com';

  const routes = [
    { path: '', priority: 1.0, changeFrequency: 'always' },
    { path: '/shillong-teer-result/', priority: 0.9, changeFrequency: 'hourly' },
    { path: '/khanapara-teer-result/', priority: 0.9, changeFrequency: 'hourly' },
    { path: '/juwai-teer-result/', priority: 0.9, changeFrequency: 'hourly' },
    { path: '/shillong-night-teer/', priority: 0.8, changeFrequency: 'hourly' },
    { path: '/teer-dream-numbers/', priority: 0.8, changeFrequency: 'weekly' },
    { path: '/previous-results/', priority: 0.8, changeFrequency: 'daily' },
    { path: '/teer-result-history/', priority: 0.8, changeFrequency: 'daily' },
    { path: '/what-is-teer/', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/result-verification/', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/correction-policy/', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/about-us/', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/contact/', priority: 0.5, changeFrequency: 'monthly' },
    { path: '/privacy-policy/', priority: 0.4, changeFrequency: 'monthly' },
    { path: '/terms-and-conditions/', priority: 0.4, changeFrequency: 'monthly' },
  ];

  return routes.map((r) => ({
    url: `${baseUrl}${r.path}`,
    lastModified: new Date(),
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));
}
