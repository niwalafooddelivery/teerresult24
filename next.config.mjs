import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare';

/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  serverExternalPackages: [
    '@prisma/client',
    '.prisma/client',
    'pg',
    '@prisma/adapter-pg',
  ],
};

initOpenNextCloudflareForDev();

export default nextConfig;
