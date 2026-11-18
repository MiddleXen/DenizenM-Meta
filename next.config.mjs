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
