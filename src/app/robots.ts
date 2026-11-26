import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Search result pages are endless query variations; every entry has its own page in the sitemap instead.
        disallow: ['/api/', '/webhook/', '/Webhook/', '/Docs/Search/', '/docs/search/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
