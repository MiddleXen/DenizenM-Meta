import { MetaDocsData, MetaObjectTypeObject, MetaTagObject } from './types';
import {
  getCommandAsyncStatus,
  getTagAsyncStatus,
  getObjectTypeAsyncStatus,
} from './async-safety';

export type SuggestionType = 'Command' | 'Tag' | 'Event' | 'Mechanism' | 'Action' | 'Language' | 'ObjectType';

export interface SearchSuggestion {
  name: string;
  cleanName: string;
  type: SuggestionType;
  href: string;
  description: string;
  keywords?: string[];
}

export type CompactSuggestionTuple =
  | [string, string, string, string]
  | [string, string, string, string, string[]];

const TYPE_TO_CODE: Record<SuggestionType, string> = {
  Command: 'C',
  Tag: 'T',
  Event: 'E',
  Mechanism: 'M',
  Action: 'A',
  Language: 'L',
  ObjectType: 'O',
};

const CODE_TO_TYPE: Record<string, SuggestionType> = {
  C: 'Command',
  T: 'Tag',
  E: 'Event',
  M: 'Mechanism',
  A: 'Action',
  L: 'Language',
  O: 'ObjectType',
};

export function hrefForSuggestion(type: SuggestionType, cleanName: string): string {
  const enc = encodeURIComponent(cleanName);
  switch (type) {
    case 'Command':
      return `/Docs/Commands/${enc}`;
    case 'Tag':
      return `/Docs/Tags/${enc}`;
    case 'Event':
      return `/Docs/Events/${enc}`;
    case 'Mechanism':
      return `/Docs/Mechanisms/${enc}`;
    case 'Action':
      return `/Docs/Actions/${enc}`;
    case 'Language':
      return `/Docs/Languages/${enc}`;
    case 'ObjectType':
      return `/Docs/ObjectTypes/${enc}`;
    default:
      return `/Docs/Search/${enc}`;
  }
}

export function serializeSuggestions(list: SearchSuggestion[]): string {
  const compact: CompactSuggestionTuple[] = list.map((s) => {
    const code = TYPE_TO_CODE[s.type] || 'C';
    const cleanDiff = s.cleanName === s.name.toLowerCase() ? '' : s.cleanName;
    if (s.keywords && s.keywords.length > 0) {
      return [code, s.name, cleanDiff, s.description, s.keywords];
    }
    return [code, s.name, cleanDiff, s.description];
  });
  return JSON.stringify(compact);
}

export function parseSuggestionsPayload(raw: unknown): SearchSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry): SearchSuggestion => {
    if (Array.isArray(entry)) {
      const [code, name, cleanDiff, description, keywords] = entry as CompactSuggestionTuple;
      const type = CODE_TO_TYPE[code] || 'Command';
      const cleanName = cleanDiff || String(name).toLowerCase();
      return {
        name: String(name),
        cleanName,
        type,
        href: hrefForSuggestion(type, cleanName),
        description: String(description || ''),
        keywords: Array.isArray(keywords) ? keywords : undefined,
      };
    }
    const obj = entry as SearchSuggestion;
    const type = obj.type || 'Command';
    const cleanName = obj.cleanName || String(obj.name || '').toLowerCase();
    return {
      name: obj.name,
      cleanName,
      type,
      href: obj.href || hrefForSuggestion(type, cleanName),
      description: obj.description || '',
      keywords: obj.keywords,
    };
  });
}

export function buildSuggestionsFromDocs(docs: MetaDocsData): SearchSuggestion[] {
  return docs.allObjects.map((obj) => {
    const type = (obj.type as SuggestionType) || 'Command';
    const href = hrefForSuggestion(type, obj.cleanName);

    const rawDesc =
      obj.rawValues?.description?.[0] ||
      (obj as { short?: string; description?: string; triggers?: string }).short ||
      (obj as { description?: string }).description ||
      (obj as { triggers?: string }).triggers ||
      '';
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
      const tag = obj as MetaTagObject;
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
      const ot = obj as MetaObjectTypeObject;
      const otAsync = getObjectTypeAsyncStatus(ot.typeName || ot.cleanName);
      if (otAsync.isFullSafe || otAsync.isPartial) {
        if (!keywords.includes('async')) keywords.push('async');
      }
    }

    const isAsyncRelated =
      obj.cleanName.includes('async') ||
      obj.name.toLowerCase().includes('async') ||
      obj.cleanName === 'util.is_main_thread' ||
      obj.cleanName === 'util.current_thread' ||
      obj.cleanName === 'util.linger_stats' ||
      obj.cleanName === 'util.current_time_nanos' ||
      ((obj as { syntax?: string }).syntax && (obj as { syntax?: string }).syntax!.toLowerCase().includes('(async)'));

    if (isAsyncRelated && !keywords.includes('async')) {
      keywords.push('async');
    }

    return {
      name: obj.name,
      cleanName: obj.cleanName,
      type,
      href,
      description: firstDesc.length > 90 ? firstDesc.slice(0, 87) + '...' : firstDesc,
      keywords: keywords.length > 0 ? keywords : undefined,
    };
  });
}

interface NormalizedSuggestion {
  c: string;
  n: string;
  d: string;
  untaggedClean: string;
  untaggedName: string;
  keywords: string[];
  combined: string;
}

/** Lower-cased/derived strings per suggestion, computed once instead of on every keystroke. */
const normalizedCache = new WeakMap<SearchSuggestion, NormalizedSuggestion>();

function normalize(item: SearchSuggestion): NormalizedSuggestion {
  let norm = normalizedCache.get(item);
  if (!norm) {
    const c = item.cleanName.toLowerCase();
    const n = item.name.toLowerCase().replace(/^<|>$/g, '');
    const d = item.description.toLowerCase();
    const keywords = (item.keywords || []).map((k) => k.toLowerCase());
    norm = {
      c,
      n,
      d,
      untaggedClean: c.replace(/tag\./g, '.'),
      untaggedName: n.replace(/tag\./g, '.'),
      keywords,
      combined: `${c} ${n} ${d} ${keywords.join(' ')}`,
    };
    normalizedCache.set(item, norm);
  }
  return norm;
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

  const words = q.split(/\s+/).filter(Boolean);

  const scored: Array<{ item: SearchSuggestion; score: number }> = [];

  for (const item of filtered) {
    const { c, n, d, untaggedClean, untaggedName, keywords, combined } = normalize(item);
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
    } else if (keywords.some((k) => k === q)) {
      score = 45;
    } else if (keywords.some((k) => k.includes(q))) {
      score = 35;
    } else if (d.includes(q)) {
      score = 25;
    }

    if (score === 0 && words.length > 1) {
      const allWordsInClean = words.every((w) => c.includes(w) || untaggedClean.includes(w));
      const allWordsInName = words.every((w) => n.includes(w) || untaggedName.includes(w));
      const allWordsInItem = words.every((w) => combined.includes(w));

      if (allWordsInClean || allWordsInName) {
        score = 70;
      } else if (allWordsInItem) {
        score = 40;
      }
    }

    if (score > 0) {
      scored.push({ item, score });
    }
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return a.item.cleanName.length - b.item.cleanName.length;
  });

  return scored.slice(0, limit).map((s) => s.item);
}
