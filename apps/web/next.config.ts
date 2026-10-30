import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  // Document uploads from server actions (the console; later the Docs tab).
  experimental: { serverActions: { bodySizeLimit: '26mb' } },
}

export default nextConfig
