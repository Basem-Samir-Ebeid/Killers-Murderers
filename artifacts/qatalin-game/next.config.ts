import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@workspace/api-client-react', '@workspace/db'],
  serverExternalPackages: ['pg', 'pg-native'],
}

export default nextConfig
