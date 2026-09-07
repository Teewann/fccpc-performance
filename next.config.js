/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["@prisma/client", "prisma"],
  
  // ✅ Add experimental features
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // ✅ API timeout - helps prevent long waits
  staticPageGenerationTimeout: 60,
};

module.exports = nextConfig;