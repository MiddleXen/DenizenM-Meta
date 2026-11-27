import { fileURLToPath } from 'node:url';

// Absolute path of this project. Pinning it stops Next.js from picking up an unrelated
// package-lock.json in a parent folder (e.g. ~/Downloads) as the workspace root.
const projectRoot = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Nobody may frame the site (clickjacking); link previews (Discord etc.) use meta tags, not frames.
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        ],
      },
    ];
  },
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
    const docSections = [
      ['commands', 'Commands'],
      ['tags', 'Tags'],
      ['events', 'Events'],
      ['mechanisms', 'Mechanisms'],
      ['actions', 'Actions'],
      ['languages', 'Languages'],
      ['objecttypes', 'ObjectTypes'],
      ['object-types', 'ObjectTypes'],
      ['search', 'Search'],
    ];
    const sectionRewrites = docSections.flatMap(([lower, canonical]) => [
      { source: `/docs/${lower}`, destination: `/Docs/${canonical}` },
      { source: `/docs/${lower}/:path*`, destination: `/Docs/${canonical}/:path*` },
    ]);
    return [
      ...sectionRewrites,
      {
        source: '/docs',
        destination: '/Docs',
      },
      {
        source: '/docs/:path*',
        destination: '/Docs/:path*',
      },
      {
        source: '/webhook/reload',
        destination: '/Webhook/Reload',
      },
      {
        source: '/webhook/:path*',
        destination: '/Webhook/:path*',
      },
    ];
  },
};

export default nextConfig;
