/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['adm-zip'],
  outputFileTracingIncludes: {
    '/**': ['./public/data/**'],
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*',
        destination: '/Docs/:path*',
      },
      {
        source: '/webhook/:path*',
        destination: '/Webhook/:path*',
      },
    ];
  },
};

export default nextConfig;
