import { MetaDocsData, MetaEventObject, MetaObjectTypeObject, MetaTagObject } from './types';
import {
  getCommandAsyncStatus,
  getTagAsyncStatus,
  getObjectTypeAsyncStatus,
} from './async-safety';
import { expandInheritedQueries, normalizeScriptQuery } from './object-inheritance';

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
    } else if (obj.type === 'Event') {
      const evt = obj as MetaEventObject;
      if (evt.events && evt.events.length > 1) {
        for (let j = 1; j < evt.events.length; j++) {
          const line = evt.events[j];
          if (line && !keywords.includes(line)) keywords.push(line);
        }
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
  item: SearchSuggestion;
  typeLow: string;
  c: string;
  n: string;
  d: string;
  untaggedClean: string;
  untaggedName: string;
  keywords: string[];
  combined: string;
  eventTokenLines?: string[][];
}

/** Pre-normalized index cached once per suggestion list reference (eliminates 3,978 WeakMap lookups per keystroke). */
const listIndexCache = new WeakMap<SearchSuggestion[], NormalizedSuggestion[]>();

function buildNormalizedEntry(item: SearchSuggestion): NormalizedSuggestion {
  const rawNameLow = item.name.toLowerCase();
  const c = item.cleanName.toLowerCase();
  const n = rawNameLow.replace(/^<|>$/g, '');
  const d = item.description.toLowerCase();
  const keywords = (item.keywords || []).map((k) => k.toLowerCase());
  const entry: NormalizedSuggestion = {
    item,
    typeLow: item.type.toLowerCase(),
    c,
    n,
    d,
    untaggedClean: c.replace(/tag\./g, '.'),
    untaggedName: n.replace(/tag\./g, '.'),
    keywords,
    combined: `${c} ${n} ${d} ${keywords.join(' ')}`,
  };
  if (item.type === 'Event') {
    const lines = [rawNameLow, ...keywords.filter((k) => k.includes(' '))];
    entry.eventTokenLines = lines.map((l) => l.split(/\s+/).filter(Boolean));
  }
  return entry;
}

function getIndexedList(list: SearchSuggestion[]): NormalizedSuggestion[] {
  let indexed = listIndexCache.get(list);
  if (!indexed) {
    indexed = list.map(buildNormalizedEntry);
    listIndexCache.set(list, indexed);
  }
  return indexed;
}

/** Browser-safe lightweight matcher for event patterns like `<entity> enters|exits <area>` or `player breaks (<material>)`. */
function matchSuggestionEventTokens(eventTokens: string[], qWords: string[]): number {
  if (qWords.length < 2 || eventTokens.length === 0) return 0;
  let ei = 0;
  let qi = 0;
  let literalHits = 0;
  let exactTypeHits = 0;

  while (ei < eventTokens.length && qi < qWords.length) {
    const rawTok = eventTokens[ei];
    const isOpt = rawTok.startsWith('(') && rawTok.endsWith(')');
    const tok = isOpt ? rawTok.slice(1, -1) : rawTok;
    const qw = qWords[qi];

    if (tok.startsWith('<') && tok.endsWith('>')) {
      const inner = tok.slice(1, -1).replace(/'/g, '');
      if (inner === qw) exactTypeHits++;
      ei++;
      qi++;
      continue;
    }

    const literalMatch = tok.includes('|')
      ? tok.split('|').some((opt) => opt.replace(/[<>']/g, '') === qw)
      : tok === qw;

    if (literalMatch) {
      literalHits++;
      ei++;
      qi++;
    } else if (isOpt) {
      ei++;
    } else {
      return 0;
    }
  }

  while (ei < eventTokens.length) {
    const rawTok = eventTokens[ei];
    if (rawTok.startsWith('(') && rawTok.endsWith(')')) ei++;
    else break;
  }

  return ei === eventTokens.length && qi === qWords.length && literalHits >= 1
    ? 70 + Math.min(8, literalHits * 2 + exactTypeHits * 4)
    : 0;
}

export function filterSuggestions(
  list: SearchSuggestion[],
  rawQuery: string,
  limit = 50,
  categoryFilter?: string
): SearchSuggestion[] {
  const nq = normalizeScriptQuery(rawQuery);
  let q = nq.cleaned;
  if (nq.hasTagSyntax && nq.tagCleaned) {
    q = nq.tagCleaned;
  } else if (nq.hasEventSyntax && nq.strippedEvent) {
    q = nq.strippedEvent;
  } else if (nq.hasCmdSyntax && nq.strippedCmd) {
    q = nq.strippedCmd;
  }
  q = q.replace(/^<|>$/g, '').trim();
  if (!q) return [];

  const catLow = categoryFilter ? categoryFilter.toLowerCase() : null;
  const words = q.split(/\s+/).filter(Boolean);
  const eventWords = words.filter((w) => !w.includes(':'));
  const inheritedTargets = q.includes('.') ? expandInheritedQueries(q) : [];

  const indexed = getIndexedList(list);
  const scored: Array<{ item: SearchSuggestion; score: number }> = [];

  for (let i = 0; i < indexed.length; i++) {
    const entry = indexed[i];
    if (catLow && entry.typeLow !== catLow) continue;

    const { item, c, n, d, untaggedClean, untaggedName, keywords, combined, eventTokenLines } = entry;
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

    if (score < 92 && inheritedTargets.length > 0 && (item.type === 'Tag' || item.type === 'Mechanism')) {
      if (inheritedTargets.some((t) => c === t || untaggedClean === t)) {
        score = 92;
      } else if (score < 82 && inheritedTargets.some((t) => c.startsWith(t) || untaggedClean.startsWith(t))) {
        score = 82;
      }
    }

    if (score === 0 && eventTokenLines && eventWords.length >= 2) {
      for (let t = 0; t < eventTokenLines.length; t++) {
        const s = matchSuggestionEventTokens(eventTokenLines[t], eventWords);
        if (s > score) score = s;
      }
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
