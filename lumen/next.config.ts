import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `LUMEN_EXPORT=1 next build` produces a static site in out/ (used for hosted previews).
  ...(process.env.LUMEN_EXPORT === '1' ? { output: 'export' as const } : {}),
};

export default nextConfig;
