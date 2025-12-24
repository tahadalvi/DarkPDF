/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Enable static export for desktop app
  output: process.env.BUILD_STANDALONE === 'true' ? 'export' : undefined,

  // Disable image optimization for static export (not supported)
  images: {
    unoptimized: true,
  },

  // Ensure trailing slashes for static hosting
  trailingSlash: process.env.BUILD_STANDALONE === 'true',

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
  },
};

module.exports = nextConfig;
