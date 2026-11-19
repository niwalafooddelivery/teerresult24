import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  poweredByHeader: false,
  compress: true,
  serverExternalPackages: [
    '@prisma/client',
    '.prisma/client',
    'pg',
    '@prisma/adapter-pg',
  ],
  async headers() {
    return [
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/api/admin/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, max-age=0, must-revalidate',
          },
        ],
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
        ],
      },
    ];
  },
};

initOpenNextCloudflareForDev();

export default nextConfig;
