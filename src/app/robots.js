export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/admin/'],
      },
    ],
    sitemap: 'https://teerresult2.com/sitemap.xml',
  };
}
