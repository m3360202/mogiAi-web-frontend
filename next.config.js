/** @type {import('next').NextConfig} */
const createNextIntlPlugin = require('next-intl/plugin');

// The path to your request configuration
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig = {
  reactStrictMode: true,
  // Cloud Run friendly: smaller runtime image + no need to ship full source/node_modules
  output: 'standalone',
  // CI/Cloud Build: do not fail build on missing local ESLint plugins.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = withNextIntl(nextConfig);
