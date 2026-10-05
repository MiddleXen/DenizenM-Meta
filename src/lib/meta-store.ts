import fs from 'fs';
import path from 'path';
import {
  AnyMetaObject,
  BaseMetaObject,
  DocViewModel,
  MetaDocsData,
  MetaEventObject,
} from './types';
import { getMatchQuality, loadAllMetaDocs, DEFAULT_SOURCES } from './meta-loader';
import { escapeForHTML } from './util';

const SEARCH_QUALITY_NAMES = [
  'Not Matched', // 0
  'Just Barely Matched', // 1
  'Backup Match', // 2
  'Semi-Decent Match', // 3
  'Decent Match', // 4
  'Semi-Strong Match', // 5
  'Strong Match', // 6
  'Partial Synonym Match', // 7
  'Perfect Synonym Match', // 8
  'Partial Name Match', // 9
  'Perfect Name Match', // 10
];

let globalMetaDocs: MetaDocsData | null = null;
let globalCacheMtime = 0;
let isLoading = false;
let loadPromise: Promise<MetaDocsData> | null = null;

const CACHE_FILE = path.join(process.cwd(), 'cache', 'meta-docs.json');
const PRESET_FILE = path.join(process.cwd(), 'public', 'data', 'denizen-meta.json');

export async function getMetaDocs(forceReload = false): Promise<MetaDocsData> {
  // Check which file is newer between CACHE_FILE and PRESET_FILE
  let chosenFile: string | null = null;
  let chosenMtime = 0;

  if (!forceReload) {
    if (fs.existsSync(PRESET_FILE)) {
      const presetMtime = fs.statSync(PRESET_FILE).mtimeMs;
      chosenFile = PRESET_FILE;
      chosenMtime = presetMtime;
    }
    if (fs.existsSync(CACHE_FILE)) {
      const cacheMtime = fs.statSync(CACHE_FILE).mtimeMs;
      if (!chosenFile || cacheMtime > chosenMtime) {
        chosenFile = CACHE_FILE;
        chosenMtime = cacheMtime;
      }
    }
  }

  if (chosenFile) {
    try {
      if (globalMetaDocs && chosenMtime <= globalCacheMtime) {
        return globalMetaDocs;
      }
      const cached = JSON.parse(fs.readFileSync(chosenFile, 'utf8'));
      globalMetaDocs = cached;
      globalCacheMtime = chosenMtime;
      return cached;
    } catch (e) {
      console.error('Failed to read meta docs file:', e);
    }
  }

  if (globalMetaDocs && !forceReload) {
    return globalMetaDocs;
  }

  if (isLoading && loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    isLoading = true;
    try {
      // 1. Check in-memory
      if (globalMetaDocs && !forceReload) {
        return globalMetaDocs;
      }

      // 2. Try loading cached or pre-generated JSON if not forcing reload
      if (!forceReload) {
        if (fs.existsSync(CACHE_FILE)) {
          try {
            const stat = fs.statSync(CACHE_FILE);
            const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
            const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
            globalMetaDocs = cached;
            globalCacheMtime = stat.mtimeMs;

            if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
              console.log('Cache is older than 5 minutes, checking GitHub for new commits in background...');
              setTimeout(() => {
                reloadMetaDocs().catch((e) => console.error('Background auto-reload error:', e));
              }, 1000);
            } else {
              console.log('Loading meta docs from fresh cache file...');
            }

            return cached;
          } catch (e) {
            console.error('Failed to read cache file:', e);
          }
        }
        if (fs.existsSync(PRESET_FILE)) {
          try {
            console.log('Loading meta docs from preset file...');
            const stat = fs.statSync(PRESET_FILE);
            const preset = JSON.parse(fs.readFileSync(PRESET_FILE, 'utf8'));
            globalMetaDocs = preset;
            globalCacheMtime = stat.mtimeMs;
            // Also trigger background check from live sources
            setTimeout(() => {
              reloadMetaDocs().catch((e) => console.error('Background init reload error:', e));
            }, 1000);
            return preset;
          } catch (e) {
            console.error('Failed to read preset file:', e);
          }
        }

        // 2b. On Vercel serverless, fetch from static CDN asset if local preset was not found on disk
        if (!globalMetaDocs && (process.env.VERCEL || process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL)) {
          const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'denizen-meta-website.vercel.app';
          const cdnUrl = host.startsWith('http') ? `${host}/data/denizen-meta.json` : `https://${host}/data/denizen-meta.json`;
          try {
            console.log(`Fetching pre-baked meta docs from Vercel CDN ${cdnUrl}...`);
            const res = await fetch(cdnUrl, { cache: 'no-store' });
            if (res.ok) {
              const data = await res.json();
              globalMetaDocs = data;
              return data;
            }
          } catch (cdnErr) {
            console.warn('CDN fetch fallback error:', cdnErr);
          }
        }
      }

      // 3. Download and parse
      console.log('Downloading and parsing meta documentation from source...');
      const docs = await loadAllMetaDocs(DEFAULT_SOURCES, forceReload);
      globalMetaDocs = docs;

      // Save to cache and preset
      try {
        const cacheDir = path.dirname(CACHE_FILE);
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }
        const jsonStr = JSON.stringify(docs);
        fs.writeFileSync(CACHE_FILE, jsonStr);
        globalCacheMtime = fs.statSync(CACHE_FILE).mtimeMs;
        try {
          fs.writeFileSync(PRESET_FILE, jsonStr);
        } catch (e) {
          console.error('Failed to update PRESET_FILE:', e);
        }
      } catch (err) {
        console.error('Failed to write meta-docs cache:', err);
      }

      return docs;
    } finally {
      isLoading = false;
    }
  })();

  return loadPromise;
}

export async function reloadMetaDocs(): Promise<MetaDocsData> {
  return getMetaDocs(true);
}

export function sortMetaObjects<T extends BaseMetaObject>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    // 1. Plugin (Core without plugin comes first: 0 vs 1)
    const aPlugin = a.plugin ? 1 : 0;
    const bPlugin = b.plugin ? 1 : 0;
    if (aPlugin !== bPlugin) return aPlugin - bPlugin;

    // 2. Warnings count
    const aWarn = a.warnings ? a.warnings.length : 0;
    const bWarn = b.warnings ? b.warnings.length : 0;
    if (aWarn !== bWarn) return aWarn - bWarn;

    // 3. Group (null / empty first, or alphabetical)
    const aGroup = a.group || '';
    const bGroup = b.group || '';
    if (aGroup !== bGroup) {
      if (!aGroup) return -1;
      if (!bGroup) return 1;
      const grpCmp = aGroup.localeCompare(bGroup);
      if (grpCmp !== 0) return grpCmp;
    }

    // 4. CleanName alphabetical
    return a.cleanName.localeCompare(b.cleanName);
  });
}

export function cleanHtmlContent(text: string): string {
  if (!text) return '';
  return text
    .replace(/<\/pre>\s*(?:<br\s*\/?>\s*)+/gi, '</pre>\n')
    .replace(/(?:<br\s*\/?>\s*)+<pre>/gi, '\n<pre>')
    .replace(/(?<!<span class="meta_link_badge">)<span class="meta_url">([^<]+)<\/span>\s*<a href="(\/Docs\/[^"]+)">([\s\S]*?)<\/a>/gi, '<span class="meta_link_badge"><span class="meta_url">$1</span><a class="meta_link_anchor" href="$2">$3</a></span>');
}

export function handleMetaPage<T extends AnyMetaObject>(
  objects: T[],
  search: string | null | undefined,
  extraResults?: (current: T[]) => T[] | null
): DocViewModel {
  // Always guarantee exact original sorting: plugin ? 1 : 0 -> warnings.length -> group -> cleanName
  const sorted = sortMetaObjects(objects);
  const cleanSearch = search ? search.trim().toLowerCase() : null;

  let toDisplay: T[];
  if (!cleanSearch) {
    toDisplay = [...sorted];
  } else {
    toDisplay = sorted.filter((o) => getMatchQuality(o.searchHelper, cleanSearch) > 6);
  }

  if (extraResults) {
    const extra = extraResults(toDisplay);
    if (extra && extra.length > 0) {
      toDisplay.unshift(...extra);
    }
  }

  if (cleanSearch) {
    const exactMatch = toDisplay.find((o) => {
      if (o.cleanName === cleanSearch) return true;
      if (o.type === 'Tag') {
        const untagged = o.cleanName.replace(/tag\./g, '.');
        if (untagged === cleanSearch) return true;
      }
      return false;
    });
    if (exactMatch) {
      toDisplay = [exactMatch];
    }
  }

  // Categories extracted in the exact order they appear in toDisplay (preserving sorted group order)
  const categories: string[] = [];
  const categorySet = new Set<string>();
  for (const obj of toDisplay) {
    const grp = obj.groupingString || '(ERROR MISSING GROUP)';
    if (!categorySet.has(grp)) {
      categorySet.add(grp);
      categories.push(grp);
    }
  }

  let outText = '<center>\n';

  if (categories.length > 1) {
    outText += '<div class="categories_wrapper">\n';
    outText += `  <div class="categories_header"><span class="categories_title">Categories</span><span class="categories_badge">${categories.length}</span></div>\n`;
    outText += '  <div class="categories_container">\n';
    outText += categories
      .map((cat) => {
        const linkable = encodeURIComponent(cat.toLowerCase());
        return `    <a href="#${linkable}" onclick="doFlashFor('${linkable}', event)" class="category_chip">${escapeForHTML(cat)}</a>`;
      })
      .join('\n');
    outText += '\n  </div>\n</div>\n';

    for (const cat of categories) {
      const linkable = encodeURIComponent(cat.toLowerCase());
      outText += `<hr class="category_divider"><h4 class="category_title">Category: <a id="${linkable}" href="#${linkable}" onclick="doFlashFor('${linkable}', event)">${escapeForHTML(cat)}</a></h4>\n`;
      const catObjs = toDisplay.filter((o) => (o.groupingString || '(ERROR MISSING GROUP)') === cat);
      const distinctHtml = Array.from(new Set(catObjs.map((o) => o.htmlContent)));
      outText += distinctHtml.join('\n');
    }
  } else {
    outText += toDisplay.map((o) => o.htmlContent).join('\n');
  }

  outText += '</center>';

  return {
    isAll: !cleanSearch,
    currentlyShown: toDisplay.length,
    max: objects.length,
    contentHtml: cleanHtmlContent(outText),
    searchText: search || null,
    categories,
  };
}

export function handleGlobalSearch(allObjects: AnyMetaObject[], query: string | null | undefined): DocViewModel {
  const q = (query || '').trim();
  if (!q || q.toLowerCase() === 'nothing') {
    return {
      isAll: false,
      currentlyShown: 0,
      max: allObjects.length,
      contentHtml: '<center></center>',
      searchText: q && q.toLowerCase() !== 'nothing' ? q : '',
      categories: [],
    };
  }
  const searchLow = q.toLowerCase();

  const matches: Array<{ quality: number; obj: AnyMetaObject }> = [];

  for (const obj of allObjects) {
    const quality = getMatchQuality(obj.searchHelper, searchLow);
    if (quality > 0) {
      matches.push({ quality, obj });
    }
  }

  // Order: -quality, obj.type, obj.cleanName
  matches.sort((a, b) => {
    if (a.quality !== b.quality) {
      return b.quality - a.quality;
    }
    if (a.obj.type !== b.obj.type) {
      return a.obj.type.localeCompare(b.obj.type);
    }
    return a.obj.cleanName.localeCompare(b.obj.cleanName);
  });

  let outText = '<center>';
  if (matches.length > 0) {
    let lastQuality = -1;
    let lastType = '';

    for (const match of matches) {
      if (match.quality !== lastQuality) {
        lastQuality = match.quality;
        const qualityName = SEARCH_QUALITY_NAMES[match.quality] || 'Matched';
        outText += `<h4 class="category_title mt-4 mb-2">${qualityName} Results</h4>`;
      }
      if (match.obj.type !== lastType) {
        lastType = match.obj.type;
        outText += `<h4 class="category_title mt-3 mb-2">${lastType}</h4>`;
      }
      outText += match.obj.htmlContent;
    }
  } else {
    outText += `<div class="my-8 px-6 py-8 rounded-xl bg-slate-100 dark:bg-[#282b32] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm font-medium text-center max-w-md mx-auto">
      No documentation entries found matching &ldquo;<strong>${escapeForHTML(q)}</strong>&rdquo;.
    </div>`;
  }
  outText += '</center>';

  return {
    isAll: false,
    currentlyShown: matches.length,
    max: allObjects.length,
    contentHtml: cleanHtmlContent(outText),
    searchText: q,
    categories: [],
  };
}
