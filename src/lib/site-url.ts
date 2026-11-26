/**
 * Public base URL of the site (no trailing slash), for absolute links in sitemap.xml / robots.txt.
 * NEXT_PUBLIC_SITE_URL wins (set it for a custom domain); on Vercel the production domain is used automatically.
 */
export function siteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    `localhost:${process.env.PORT || 8098}`;
  const withProto = raw.startsWith('http') ? raw : raw.startsWith('localhost') ? `http://${raw}` : `https://${raw}`;
  return withProto.replace(/\/+$/, '');
}
