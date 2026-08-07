/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["@prisma/client", "prisma"],
};

module.exports = nextConfig;