import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  outputFileTracingRoot: path.join(__dirname),
  distDir: process.env.NEXT_DIST_DIR || '.next',
  experimental: {
    optimizeCss: true,
  },
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default nextConfig;
