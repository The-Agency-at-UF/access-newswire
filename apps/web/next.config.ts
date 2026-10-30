import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  // Document uploads from server actions (the console and the Docs tab).
  experimental: { serverActions: { bodySizeLimit: '4.5mb' } },
}

export default nextConfig
