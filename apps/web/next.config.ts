import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  // Output schemas are shared with the worker as TypeScript source.
  transpilePackages: ['@access/ai'],
  // Document uploads from server actions (the console and the Docs tab).
  experimental: { serverActions: { bodySizeLimit: '4.5mb' } },
}

export default nextConfig
