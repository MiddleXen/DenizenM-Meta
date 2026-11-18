import { fileURLToPath } from 'node:url';

// Absolute path of this project. Pinning it stops Next.js from picking up an unrelated
// package-lock.json in a parent folder (e.g. ~/Downloads) as the workspace root.
const projectRoot = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  serverExternalPackages: ['adm-zip'],
  outputFileTracingIncludes: {
    '/**': ['./public/data/**'],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizeCss: true,
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*',
        destination: '/Docs/:path*',
      },
      {
        source: '/docs',
        destination: '/Docs',
      },
      {
        source: '/webhook/:path*',
        destination: '/Webhook/:path*',
      },
    ];
  },
};

export default nextConfig;
