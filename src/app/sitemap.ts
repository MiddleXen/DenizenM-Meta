import type { MetadataRoute } from 'next';
import { getMetaDocs } from '@/lib/meta-store';
import { hrefForSuggestion, type SuggestionType } from '@/lib/suggestions';
import { siteUrl } from '@/lib/site-url';

// Built with the site; every meta sync is a new deploy, so the sitemap always matches the docs.
export const dynamic = 'force-static';

const SECTIONS = ['Commands', 'Tags', 'Events', 'Mechanisms', 'ObjectTypes', 'Languages', 'Actions'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const docs = await getMetaDocs();
  const base = siteUrl();
  const lastModified = new Date(docs.lastReload || Date.now());

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified, changeFrequency: 'daily', priority: 1 },
    ...SECTIONS.map((s) => ({
      url: `${base}/Docs/${s}`,
      lastModified,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
  ];

  const seen = new Set<string>();
  for (const obj of docs.allObjects) {
    const href = hrefForSuggestion(obj.type as SuggestionType, obj.cleanName);
    if (href.startsWith('/Docs/Search/') || seen.has(href)) continue;
    seen.add(href);
    entries.push({
      url: base + href,
      changeFrequency: 'weekly',
      priority: obj.type === 'Command' || obj.type === 'Event' ? 0.6 : 0.5,
    });
  }
  return entries;
}
