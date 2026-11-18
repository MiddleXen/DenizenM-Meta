import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import {
  AnyMetaObject,
  AsyncFilterCounts,
  BaseMetaObject,
  DocViewModel,
  MetaDocsData,
  MetaEventObject,
  MetaObjectTypeObject,
  MetaTagObject,
  PluginFilterOption,
} from './types';
import {
  getMatchQuality,
  hydrateMetaDocs,
  loadAllMetaDocs,
  serializeMetaDocs,
  DEFAULT_SOURCES,
} from './meta-loader';
import {
  getCommandAsyncStatus,
  getObjectTypeAsyncStatus,
  getTagAsyncStatus,
} from './async-safety';
import { matchEventPattern } from './meta-data';
import { expandInheritedQueries, normalizeScriptQuery } from './object-inheritance';
import { buildSuggestionsFromDocs, serializeSuggestions } from './suggestions';
import { escapeForHTML, escapeHtmlAttr } from './util';

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
let loadPromise: Promise<MetaDocsData> | null = null;

const CACHE_FILE = path.join(process.cwd(), 'cache', 'meta-docs.json');
const PRESET_FILE = path.join(process.cwd(), 'public', 'data', 'denizen-meta.json');
const SUGGESTIONS_FILE = path.join(process.cwd(), 'public', 'data', 'search-suggestions.json');

async function statMtime(filePath: string): Promise<number> {
  try {
    const st = await fsp.stat(filePath);
    return st.mtimeMs;
  } catch {
    return 0;
  }
}

export async function getMetaDocs(forceReload = false): Promise<MetaDocsData> {
  // Fast in-memory path: zero filesystem syscalls per request once loaded.
  if (globalMetaDocs && !forceReload) {
    return globalMetaDocs;
  }

  if (loadPromise) {
    return loadPromise;
  }

  const task = (async (): Promise<MetaDocsData> => {
    if (!forceReload) {
      const [presetMtime, cacheMtime] = await Promise.all([
        statMtime(PRESET_FILE),
        statMtime(CACHE_FILE),
      ]);
      const chosenFile =
        cacheMtime > presetMtime && cacheMtime > 0
          ? CACHE_FILE
          : presetMtime > 0
          ? PRESET_FILE
          : null;

      if (chosenFile) {
        try {
          const rawStr = await fsp.readFile(chosenFile, 'utf8');
          const hydrated = hydrateMetaDocs(JSON.parse(rawStr));
          globalMetaDocs = hydrated;
          return hydrated;
        } catch (e) {
          console.error('Failed to read meta docs file:', e);
        }
      }

      // Vercel serverless CDN fallback if local file wasn't traced onto disk
      if (process.env.VERCEL || process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL) {
        const host =
          process.env.VERCEL_PROJECT_PRODUCTION_URL ||
          process.env.VERCEL_URL ||
          process.env.NEXT_PUBLIC_VERCEL_URL ||
          'denizen-meta-website.vercel.app';
        const cdnUrl = host.startsWith('http')
          ? `${host}/data/denizen-meta.json`
          : `https://${host}/data/denizen-meta.json`;
        try {
          const res = await fetch(cdnUrl, { cache: 'no-store' });
          if (res.ok) {
            const hydrated = hydrateMetaDocs(await res.json());
            globalMetaDocs = hydrated;
            return hydrated;
          }
        } catch (cdnErr) {
          console.warn('CDN fetch fallback error:', cdnErr);
        }
      }
    }

    // Download and parse fresh sources
    const docs = await loadAllMetaDocs(DEFAULT_SOURCES, forceReload);
    globalMetaDocs = docs;

    // Persist asynchronously without blocking the event loop
    try {
      const suggestionsStr = serializeSuggestions(buildSuggestionsFromDocs(docs));
      const jsonStr = serializeMetaDocs(docs);

      await fsp.mkdir(path.dirname(CACHE_FILE), { recursive: true }).catch(() => {});
      await fsp.writeFile(CACHE_FILE, jsonStr).catch((err) => {
        console.warn('Could not write CACHE_FILE (read-only fs on serverless is expected):', err?.message || err);
      });

      if (fs.existsSync(path.dirname(PRESET_FILE))) {
        await Promise.all([
          fsp.writeFile(PRESET_FILE, jsonStr).catch(() => {}),
          fsp.writeFile(SUGGESTIONS_FILE, suggestionsStr).catch(() => {}),
        ]);
      }
    } catch (err) {
      console.warn('Persist meta-docs warning:', err);
    }

    return docs;
  })();

  loadPromise = task;
  try {
    return await task;
  } finally {
    if (loadPromise === task) {
      loadPromise = null;
    }
  }
}

export async function reloadMetaDocs(): Promise<MetaDocsData> {
  return getMetaDocs(true);
}

export function sortMetaObjects<T extends BaseMetaObject>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const aPlugin = a.plugin ? 1 : 0;
    const bPlugin = b.plugin ? 1 : 0;
    if (aPlugin !== bPlugin) return aPlugin - bPlugin;

    const aWarn = a.warnings ? a.warnings.length : 0;
    const bWarn = b.warnings ? b.warnings.length : 0;
    if (aWarn !== bWarn) return aWarn - bWarn;

    const aGroup = a.group || '';
    const bGroup = b.group || '';
    if (aGroup !== bGroup) {
      if (!aGroup) return -1;
      if (!bGroup) return 1;
      const grpCmp = aGroup.localeCompare(bGroup);
      if (grpCmp !== 0) return grpCmp;
    }

    return a.cleanName.localeCompare(b.cleanName);
  });
}

export function getPluginBucket(pluginRaw?: string): { slug: string; label: string } {
  if (!pluginRaw || !pluginRaw.trim()) {
    return { slug: 'core', label: 'Core' };
  }
  const low = pluginRaw.toLowerCase();
  if (low.includes('depenizen')) return { slug: 'depenizen', label: 'Depenizen' };
  if (low.includes('ddiscordbot')) return { slug: 'ddiscordbot', label: 'dDiscordBot' };
  if (low.includes('citizens')) return { slug: 'citizens', label: 'Citizens' };
  if (low.includes('vault')) return { slug: 'vault', label: 'Vault' };
  return { slug: 'other', label: 'Other Addons' };
}

export function getAsyncTokens(obj: AnyMetaObject): string | null {
  if (obj.type === 'Command') {
    const info = getCommandAsyncStatus(obj.name);
    if (info.runsAsync && info.deferrable) return 'safe defer';
    if (info.runsAsync) return 'safe';
    if (info.deferrable) return 'defer';
    return 'main';
  }
  if (obj.type === 'Tag') {
    const tag = obj as MetaTagObject;
    const info = getTagAsyncStatus(tag.cleanedName || tag.cleanName, tag.beforeDot, tag.afterDotCleaned);
    return info.isSafe ? 'safe' : 'main';
  }
  if (obj.type === 'ObjectType') {
    const ot = obj as MetaObjectTypeObject;
    const info = getObjectTypeAsyncStatus(ot.typeName || ot.cleanName);
    if (info.isFullSafe) return 'safe';
    if (info.isPartial) return 'defer';
    return 'main';
  }
  return null;
}

/** Marks the end of one entry; also used as the safe place to split a page into chunks. */
export const DOC_CARD_END = '</table></div>';

export function wrapDocCard(obj: AnyMetaObject): string {
  const plugin = getPluginBucket(obj.plugin);
  const asyncTokens = getAsyncTokens(obj);
  const attrs = asyncTokens
    ? ` data-async="${asyncTokens}" data-plugin="${plugin.slug}"`
    : ` data-plugin="${plugin.slug}"`;
  return `<div class="doc-card"${attrs}>${obj.htmlContent.trim()}</div>`;
}

function summarizeFilters(items: AnyMetaObject[]): {
  asyncCounts?: AsyncFilterCounts;
  pluginOptions?: PluginFilterOption[];
} {
  let hasAsync = false;
  const asyncCounts: AsyncFilterCounts = { safe: 0, defer: 0, main: 0 };
  const pluginMap = new Map<string, PluginFilterOption>();

  for (const obj of items) {
    const tokens = getAsyncTokens(obj);
    if (tokens) {
      hasAsync = true;
      if (tokens.includes('safe')) asyncCounts.safe++;
      if (tokens.includes('defer')) asyncCounts.defer++;
      if (tokens === 'main') asyncCounts.main++;
    }
    const bucket = getPluginBucket(obj.plugin);
    let entry = pluginMap.get(bucket.slug);
    if (!entry) {
      entry = { slug: bucket.slug, label: bucket.label, count: 0 };
      pluginMap.set(bucket.slug, entry);
    }
    entry.count++;
  }

  const pluginOrder = ['core', 'depenizen', 'ddiscordbot', 'citizens', 'vault', 'other'];
  const pluginOptions = Array.from(pluginMap.values()).sort(
    (a, b) => pluginOrder.indexOf(a.slug) - pluginOrder.indexOf(b.slug)
  );

  return {
    asyncCounts: hasAsync ? asyncCounts : undefined,
    pluginOptions: pluginOptions.length > 1 ? pluginOptions : undefined,
  };
}

function renderGroupedCards<T extends AnyMetaObject>(toDisplay: T[], categories: string[]): string {
  let outText = '';
  if (categories.length > 1) {
    const entryIds = new Set<string>();
    for (const o of toDisplay) {
      entryIds.add(o.cleanName);
      entryIds.add(encodeURIComponent(o.cleanName));
    }
    const categoryAnchor = (cat: string) => {
      const linkable = encodeURIComponent(cat.toLowerCase());
      return entryIds.has(linkable) || entryIds.has(cat.toLowerCase())
        ? `category-${linkable}`
        : linkable;
    };

    outText += '<div class="categories_wrapper">\n';
    outText += `  <div class="categories_header"><span class="categories_title">Categories</span><span class="categories_badge">${categories.length}</span></div>\n`;
    outText += '  <div class="categories_container">\n';
    outText += categories
      .map((cat) => {
        const linkable = categoryAnchor(cat);
        const attrId = escapeHtmlAttr(linkable);
        return `    <a href="#${attrId}" data-category-chip="${attrId}" class="category_chip">${escapeForHTML(cat)}</a>`;
      })
      .join('\n');
    outText += '\n  </div>\n</div>\n';

    const byCategory = new Map<string, T[]>();
    for (const obj of toDisplay) {
      const grp = obj.groupingString || '(ERROR MISSING GROUP)';
      let list = byCategory.get(grp);
      if (!list) byCategory.set(grp, (list = []));
      list.push(obj);
    }

    for (const cat of categories) {
      const linkable = categoryAnchor(cat);
      const attrId = escapeHtmlAttr(linkable);
      outText += `<div class="category_header_block" data-category-header="${attrId}"><hr class="category_divider"><h4 class="category_title">Category: <a id="${attrId}" href="#${attrId}">${escapeForHTML(cat)}</a></h4></div>\n`;
      const catObjs = byCategory.get(cat) || [];
      const seenHtml = new Set<string>();
      for (const obj of catObjs) {
        if (seenHtml.has(obj.htmlContent)) continue;
        seenHtml.add(obj.htmlContent);
        outText += wrapDocCard(obj) + '\n';
      }
    }
  } else {
    outText += toDisplay.map((o) => wrapDocCard(o)).join('\n');
  }
  return outText;
}

export function handleMetaPage<T extends AnyMetaObject>(
  objects: T[],
  search: string | null | undefined,
  extraResults?: (current: T[]) => T[] | null
): DocViewModel {
  // Objects from `docs.*` dictionaries are already pre-sorted at build/hydration time.
  const cleanSearch = search ? search.trim().toLowerCase() : null;

  let toDisplay: T[];
  let scored: Array<{ obj: T; quality: number }> | null = null;
  if (!cleanSearch) {
    toDisplay = objects;
  } else {
    scored = [];
    for (const o of objects) {
      const quality = getMatchQuality(o.searchHelper, cleanSearch);
      if (quality > 0) scored.push({ obj: o, quality });
    }
    toDisplay = scored.filter((s) => s.quality > 6).map((s) => s.obj);
  }

  if (extraResults) {
    const extra = extraResults(toDisplay);
    if (extra && extra.length > 0) {
      const existing = new Set(toDisplay);
      const uniqueExtra = extra.filter((x) => !existing.has(x));
      if (uniqueExtra.length > 0) {
        toDisplay = [...uniqueExtra, ...toDisplay];
      }
    }
  }

  // Tiered quality fallback only when strict (> 6) + extraResults found nothing
  if (cleanSearch && toDisplay.length === 0 && scored && scored.length > 0) {
    const med = scored
      .filter((s) => s.quality > 4)
      .sort((a, b) => b.quality - a.quality)
      .map((s) => s.obj);
    if (med.length > 0) {
      toDisplay = med;
    } else {
      toDisplay = scored.sort((a, b) => b.quality - a.quality).map((s) => s.obj);
    }
  }

  let relatedMatches: T[] = [];
  if (cleanSearch && toDisplay.length > 1) {
    const inheritedExact = cleanSearch.includes('.') ? new Set(expandInheritedQueries(cleanSearch)) : null;
    const exactMatch = toDisplay.find((o) => {
      if (o.cleanName === cleanSearch) return true;
      if (inheritedExact && inheritedExact.has(o.cleanName)) return true;
      if (o.type === 'Tag') {
        const untagged = o.cleanName.replace(/tag\./g, '.');
        if (untagged === cleanSearch) return true;
        if (inheritedExact && inheritedExact.has(untagged)) return true;
      }
      return false;
    });
    if (exactMatch) {
      relatedMatches = toDisplay.filter((o) => o !== exactMatch);
      toDisplay = [exactMatch];
    }
  }

  const categories: string[] = [];
  const categorySet = new Set<string>();
  for (const obj of toDisplay) {
    const grp = obj.groupingString || '(ERROR MISSING GROUP)';
    if (!categorySet.has(grp)) {
      categorySet.add(grp);
      categories.push(grp);
    }
  }

  let outText = '<div class="doc-list">\n';
  outText += renderGroupedCards(toDisplay, categories);

  if (relatedMatches.length > 0) {
    const previewNames = relatedMatches
      .slice(0, 4)
      .map((m) => escapeForHTML(m.name))
      .join(', ');
    const moreSuffix = relatedMatches.length > 4 ? ', …' : '';
    outText += `<div class="related-matches-wrapper">\n`;
    outText += `  <button type="button" class="related-matches-toggle" data-related-toggle="true" aria-expanded="false">`;
    outText += `<span>Showing exact match &bull; Show <strong>${relatedMatches.length}</strong> other matching ${relatedMatches.length === 1 ? 'entry' : 'entries'} (${previewNames}${moreSuffix})</span>`;
    outText += `</button>\n`;
    outText += `  <div class="related-matches-body" hidden>\n`;
    outText += relatedMatches.map((o) => wrapDocCard(o)).join('\n');
    outText += `\n  </div>\n</div>\n`;
  }

  outText += '</div>';

  const filterSummary = toDisplay.length > 3 ? summarizeFilters(toDisplay) : {};

  return {
    isAll: !cleanSearch,
    currentlyShown: toDisplay.length,
    max: objects.length,
    contentHtml: outText,
    searchText: search || null,
    categories,
    relatedMatchesCount: relatedMatches.length > 0 ? relatedMatches.length : undefined,
    ...filterSummary,
  };
}

export function handleGlobalSearch(allObjects: AnyMetaObject[], query: string | null | undefined): DocViewModel {
  const q = (query || '').trim();
  if (!q || q.toLowerCase() === 'nothing') {
    return {
      isAll: false,
      currentlyShown: 0,
      max: allObjects.length,
      contentHtml: '<div class="doc-list"></div>',
      searchText: q && q.toLowerCase() !== 'nothing' ? q : '',
      categories: [],
    };
  }

  const searchLow = q.toLowerCase();
  const nq = normalizeScriptQuery(q);
  const primarySearch =
    nq.hasTagSyntax && nq.tagCleaned
      ? nq.tagCleaned
      : nq.hasEventSyntax && nq.strippedEvent
      ? nq.strippedEvent
      : nq.hasCmdSyntax && nq.strippedCmd
      ? nq.strippedCmd
      : nq.cleaned;

  const inheritedTargets = primarySearch.includes('.') ? expandInheritedQueries(primarySearch) : [];
  const inheritedSet = inheritedTargets.length > 0 ? new Set(inheritedTargets) : null;
  const checkEventPattern = primarySearch.includes(' ');

  const matches: Array<{ quality: number; obj: AnyMetaObject }> = [];

  for (const obj of allObjects) {
    let quality = getMatchQuality(obj.searchHelper, primarySearch);
    if (quality === 0 && primarySearch !== searchLow) {
      quality = getMatchQuality(obj.searchHelper, searchLow);
    }

    if (quality < 9 && inheritedSet && (obj.type === 'Tag' || obj.type === 'Mechanism')) {
      const untagged = obj.cleanName.replace(/tag\./g, '.');
      if (inheritedSet.has(obj.cleanName) || inheritedSet.has(untagged)) {
        quality = 9;
      } else if (
        quality < 8 &&
        inheritedTargets.some((t) => obj.cleanName.startsWith(t) || untagged.startsWith(t))
      ) {
        quality = 8;
      }
    }

    if (quality < 8 && checkEventPattern && obj.type === 'Event') {
      const evt = obj as MetaEventObject;
      for (const line of evt.events) {
        const pScore = matchEventPattern(line, primarySearch);
        if (pScore > quality) quality = pScore;
      }
    }

    if (quality > 0) {
      matches.push({ quality, obj });
    }
  }

  matches.sort((a, b) => {
    if (a.quality !== b.quality) {
      return b.quality - a.quality;
    }
    if (a.obj.type !== b.obj.type) {
      return a.obj.type.localeCompare(b.obj.type);
    }
    return a.obj.cleanName.localeCompare(b.obj.cleanName);
  });

  let outText = '<div class="doc-list">';
  if (matches.length > 0) {
    let lastQuality = -1;
    let lastType = '';

    for (const match of matches) {
      if (match.quality !== lastQuality) {
        lastQuality = match.quality;
        lastType = '';
        const qualityName = SEARCH_QUALITY_NAMES[match.quality] || 'Matched';
        outText += `<div class="category_header_block"><h4 class="category_title mt-4 mb-2">${qualityName} Results</h4></div>`;
      }
      if (match.obj.type !== lastType) {
        lastType = match.obj.type;
        outText += `<div class="category_header_block"><h4 class="category_title mt-3 mb-2">${lastType}</h4></div>`;
      }
      outText += wrapDocCard(match.obj);
    }
  } else {
    outText += `<div class="my-8 px-6 py-8 rounded-xl bg-slate-100 dark:bg-[#161922] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-sm font-medium text-center max-w-md mx-auto">
      No documentation entries found matching &ldquo;<strong>${escapeForHTML(q)}</strong>&rdquo;.
    </div>`;
  }
  outText += '</div>';

  const matchedObjs = matches.map((m) => m.obj);
  const filterSummary = matchedObjs.length > 3 ? summarizeFilters(matchedObjs) : {};

  return {
    isAll: false,
    currentlyShown: matches.length,
    max: allObjects.length,
    contentHtml: outText,
    searchText: q,
    categories: [],
    ...filterSummary,
  };
}
