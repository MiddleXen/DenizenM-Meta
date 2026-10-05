import { MetaDocsData } from './types';
import {
  getCommandAsyncStatus,
  getTagAsyncStatus,
  getObjectTypeAsyncStatus,
} from './async-safety';

export interface SearchSuggestion {
  name: string;
  cleanName: string;
  type: 'Command' | 'Tag' | 'Event' | 'Mechanism' | 'Action' | 'Language' | 'ObjectType';
  href: string;
  description: string;
  keywords?: string[];
}

export function buildSuggestionsFromDocs(docs: MetaDocsData): SearchSuggestion[] {
  return docs.allObjects.map((obj) => {
    let href = '';
    switch (obj.type) {
      case 'Command':
        href = `/Docs/Commands/${encodeURIComponent(obj.cleanName)}`;
        break;
      case 'Tag':
        href = `/Docs/Tags/${encodeURIComponent(obj.cleanName)}`;
        break;
      case 'Event':
        href = `/Docs/Events/${encodeURIComponent(obj.cleanName)}`;
        break;
      case 'Mechanism':
        href = `/Docs/Mechanisms/${encodeURIComponent(obj.cleanName)}`;
        break;
      case 'Action':
        href = `/Docs/Actions/${encodeURIComponent(obj.cleanName)}`;
        break;
      case 'Language':
        href = `/Docs/Languages/${encodeURIComponent(obj.cleanName)}`;
        break;
      case 'ObjectType':
        href = `/Docs/ObjectTypes/${encodeURIComponent(obj.cleanName)}`;
        break;
      default:
        href = `/Docs/Search/${encodeURIComponent(obj.cleanName)}`;
    }

    const rawDesc = obj.rawValues?.description?.[0] || (obj as any).short || '';
    const firstDesc = rawDesc
      .replace(/\r/g, '')
      .split('\n')[0]
      .replace(/<@link[^>]*>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim();

    const keywords = [...(obj.synonyms || [])];

    if (obj.type === 'Command') {
      const asyncInfo = getCommandAsyncStatus(obj.name);
      if (asyncInfo.runsAsync || asyncInfo.deferrable) {
        if (!keywords.includes('async')) keywords.push('async');
        if (!keywords.includes('async-safe')) keywords.push('async-safe');
      }
    } else if (obj.type === 'Tag') {
      const tag = obj as any;
      if (tag.beforeDot && tag.beforeDot.toLowerCase().endsWith('tag')) {
        const untaggedBase = tag.beforeDot.slice(0, -'tag'.length);
        const untaggedFull = untaggedBase + '.' + (tag.afterDotCleaned || '');
        if (!keywords.includes(untaggedFull)) keywords.push(untaggedFull);
        if (!keywords.includes(untaggedBase)) keywords.push(untaggedBase);
      }
      const tagAsync = getTagAsyncStatus(tag.cleanedName || tag.cleanName, tag.beforeDot, tag.afterDotCleaned);
      if (tagAsync.isSafe) {
        if (!keywords.includes('async')) keywords.push('async');
        if (!keywords.includes('async-safe')) keywords.push('async-safe');
      }
    } else if (obj.type === 'ObjectType') {
      const otAsync = getObjectTypeAsyncStatus((obj as any).typeName || obj.cleanName);
      if (otAsync.isFullSafe || otAsync.isPartial) {
        if (!keywords.includes('async')) keywords.push('async');
      }
    }

    // Ensure async tags & commands are indexed with 'async' keyword
    const isAsyncRelated =
      obj.cleanName.includes('async') ||
      obj.name.toLowerCase().includes('async') ||
      obj.cleanName === 'util.is_main_thread' ||
      obj.cleanName === 'util.current_thread' ||
      obj.cleanName === 'util.linger_stats' ||
      obj.cleanName === 'util.current_time_nanos' ||
      (obj.rawValues?.syntax?.[0] && obj.rawValues.syntax[0].toLowerCase().includes('(async)'));

    if (isAsyncRelated && !keywords.includes('async')) {
      keywords.push('async');
    }

    return {
      name: obj.name,
      cleanName: obj.cleanName,
      type: obj.type as SearchSuggestion['type'],
      href,
      description: firstDesc.length > 90 ? firstDesc.slice(0, 87) + '...' : firstDesc,
      keywords,
    };
  });
}

export function filterSuggestions(
  list: SearchSuggestion[],
  rawQuery: string,
  limit = 50,
  categoryFilter?: string
): SearchSuggestion[] {
  const q = rawQuery.trim().toLowerCase().replace(/^<|>$/g, '');
  if (!q) return [];

  const filtered = categoryFilter
    ? list.filter((item) => item.type.toLowerCase() === categoryFilter.toLowerCase())
    : list;

  const scored: Array<{ item: SearchSuggestion; score: number }> = [];

  for (const item of filtered) {
    const c = item.cleanName.toLowerCase();
    const n = item.name.toLowerCase().replace(/^<|>$/g, '');
    const d = item.description.toLowerCase();
    const untaggedClean = c.replace(/tag\./g, '.');
    const untaggedName = n.replace(/tag\./g, '.');
    let score = 0;

    if (c === q || n === q || untaggedClean === q || untaggedName === q) {
      score = 100;
    } else if (q === 'async' && c === 'async queues') {
      score = 96;
    } else if (q === 'async' && c === 'async tag safety') {
      score = 95;
    } else if (q === 'async' && c === 'async tag safety map') {
      score = 94;
    } else if (q === 'async' && c === 'queuetag.is_async') {
      score = 91;
    } else if (q === 'async' && c === 'queuetag.async_stats') {
      score = 90;
    } else if (c.startsWith(q) || untaggedClean.startsWith(q)) {
      score = 85;
    } else if (n.startsWith(q) || n.startsWith('<' + q) || untaggedName.startsWith(q)) {
      score = 80;
    } else if (c.includes('.' + q) || c.includes('_' + q) || c.includes(' ' + q) || untaggedClean.includes('.' + q)) {
      score = 75;
    } else if (c.includes(q) || untaggedClean.includes(q)) {
      score = 65;
    } else if (n.includes(q) || untaggedName.includes(q)) {
      score = 55;
    } else if (item.keywords && item.keywords.some((k) => k.toLowerCase() === q)) {
      score = 45;
    } else if (item.keywords && item.keywords.some((k) => k.toLowerCase().includes(q))) {
      score = 35;
    } else if (d.includes(q)) {
      score = 25;
    }

    if (score > 0) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    // Prefer shorter names if scores match
    return a.item.cleanName.length - b.item.cleanName.length;
  });

  return scored.slice(0, limit).map((s) => s.item);
}
