import { cache } from 'react';
import type { Metadata } from 'next';
import { DOC_CARD_END, getMetaDocs, handleGlobalSearch, handleMetaPage } from './meta-store';
import {
  getCommandAsyncStatus,
  getObjectTypeAsyncStatus,
  getTagAsyncStatus,
} from './async-safety';
import { matchEventPattern } from './meta-data';
import { expandInheritedQueries, normalizeScriptQuery } from './object-inheritance';
import { cleanTag } from './util';
import { FEATURES_STYLE_RE_SRC } from './card-height';
import { hrefForSuggestion } from './suggestions';
import {
  DocViewModel,
  MetaDocsData,
  MetaEventObject,
  MetaMechanismObject,
  MetaTagObject,
} from './types';

export const DOC_KINDS = ['Commands', 'Tags', 'Events', 'Mechanisms', 'Actions', 'Languages', 'ObjectTypes', 'Search'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

export function isDocKind(v: string | null | undefined): v is DocKind {
  return !!v && (DOC_KINDS as readonly string[]).includes(v);
}

/** Size of server-rendered HTML before the rest is deferred to the client. */
const HEAD_BUDGET_BYTES = 120_000;
const MAX_CACHE_ENTRIES = 120;
/**
 * Bump whenever the generated HTML or the head/rest split changes, so browsers never combine a
 * freshly rendered head with a rest part cached (max-age) from the previous format.
 */
const REST_FORMAT = '9';

const LIST_START = '<div class="doc-list">';
const LIST_END = '</div>';

export interface SplitDocModel extends DocViewModel {
  headHtml: string;
  restHtml: string;
  /** Summed height features ("r,c,p,x") of `restHtml`, see card-height.ts; reserved before the rest loads. */
  restEstFeatures: string;
  /** Fixed part of the rest's height: card gaps and category headers. */
  restEstExtraPx: number;
}

const CARD_FEATURES_RE = new RegExp(`<div class="doc-card"[^>]* ${FEATURES_STYLE_RE_SRC}`, 'g');
const CATEGORY_HEADER_TOKEN = 'class="category_header_block"';

/** Mirrors DocRestLoader's chunk placeholder formula (card features + 16px gaps + 64px category headers). */
function estimateRest(rest: string): { features: string; extraPx: number } {
  const sum = [0, 0, 0, 0];
  let extraPx = 0;
  if (rest) {
    CARD_FEATURES_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = CARD_FEATURES_RE.exec(rest)) !== null) {
      for (let i = 0; i < 4; i++) sum[i] += Number(m[i + 1]);
      extraPx += 16;
    }
    let at = rest.indexOf(CATEGORY_HEADER_TOKEN);
    while (at !== -1) {
      extraPx += 64;
      at = rest.indexOf(CATEGORY_HEADER_TOKEN, at + CATEGORY_HEADER_TOKEN.length);
    }
  }
  return { features: sum.join(','), extraPx };
}

// Cache is bound to the docs object identity, so a meta reload invalidates everything automatically.
let cacheDocs: MetaDocsData | null = null;
const modelCache = new Map<string, SplitDocModel>();

function matchInheritedTags(tagList: MetaTagObject[], cleanId: string): MetaTagObject[] | null {
  if (!cleanId.includes('.')) return null;
  const targets = expandInheritedQueries(cleanId);
  if (targets.length === 0) return null;

  const exact: MetaTagObject[] = [];
  const prefixed: MetaTagObject[] = [];
  for (const tag of tagList) {
    const untagged = tag.cleanName.replace(/tag\./g, '.');
    if (targets.some((t) => tag.cleanName === t || untagged === t)) {
      exact.push(tag);
    } else if (targets.some((t) => tag.cleanName.startsWith(t) || untagged.startsWith(t))) {
      prefixed.push(tag);
    }
  }
  const combined = [...exact, ...prefixed];
  return combined.length > 0 ? combined : null;
}

function matchInheritedOrFallbackMechanisms(
  mechList: MetaMechanismObject[],
  cleanId: string,
  current: MetaMechanismObject[]
): MetaMechanismObject[] | null {
  if (!cleanId.includes('.')) return null;
  const targets = expandInheritedQueries(cleanId);
  const out: MetaMechanismObject[] = [];

  if (targets.length > 0) {
    for (const mech of mechList) {
      if (targets.some((t) => mech.cleanName === t || mech.cleanName.startsWith(t))) {
        out.push(mech);
      }
    }
  }

  // Fallback for stale doc cross-links like PlayerTag.view_distance -> WorldTag.view_distance
  if (current.length === 0 && out.length === 0) {
    const dot = cleanId.indexOf('.');
    const mechName = cleanId.slice(dot + 1);
    if (mechName) {
      for (const mech of mechList) {
        if (mech.mechName.toLowerCase() === mechName) {
          out.push(mech);
        }
      }
    }
  }

  return out.length > 0 ? out : null;
}

function buildModel(docs: MetaDocsData, kind: DocKind, id: string | null): DocViewModel {
  switch (kind) {
    case 'Commands': {
      const cmdId = id ? normalizeScriptQuery(id).strippedCmd : null;
      return handleMetaPage(Object.values(docs.commands), cmdId);
    }
    case 'Tags': {
      const tagId = id ? cleanTag(id).trim().toLowerCase() : null;
      const tagList = Object.values(docs.tags);
      const extra = (current: MetaTagObject[]): MetaTagObject[] | null => {
        if (!tagId || current.some((t) => t.cleanName === tagId || t.cleanName.replace(/tag\./g, '.') === tagId)) {
          return null;
        }
        return matchInheritedTags(tagList, tagId);
      };
      return handleMetaPage(tagList, tagId, extra);
    }
    case 'Mechanisms': {
      const mechId = id ? id.trim().toLowerCase() : null;
      const mechList = Object.values(docs.mechanisms);
      const extra = (current: MetaMechanismObject[]): MetaMechanismObject[] | null => {
        if (!mechId) return null;
        return matchInheritedOrFallbackMechanisms(mechList, mechId, current);
      };
      return handleMetaPage(mechList, mechId, extra);
    }
    case 'Actions': {
      const actId = id ? normalizeScriptQuery(id).strippedEvent : null;
      return handleMetaPage(Object.values(docs.actions), actId);
    }
    case 'Languages':
      return handleMetaPage(Object.values(docs.languages), id);
    case 'ObjectTypes':
      return handleMetaPage(Object.values(docs.objectTypes), id);
    case 'Events': {
      const evtId = id ? normalizeScriptQuery(id).strippedEvent : null;
      const eventList = Object.values(docs.events);
      const extra = (current: MetaEventObject[]): MetaEventObject[] | null => {
        if (!evtId || current.some((e) => e.cleanName === evtId)) return null;

        const patternScored: Array<{ evt: MetaEventObject; score: number }> = [];
        for (const e of eventList) {
          let best = 0;
          for (const line of e.events) {
            const s = matchEventPattern(line, evtId);
            if (s > best) best = s;
          }
          if (best > 0) {
            patternScored.push({ evt: e, score: best });
          }
        }
        if (patternScored.length > 0) {
          patternScored.sort((a, b) => b.score - a.score);
          return patternScored.map((p) => p.evt);
        }

        if (current.length === 0) {
          const clean = evtId.toLowerCase();
          const matches = eventList.filter((e) => e.cleanEvents.some((ce) => ce.includes(clean)));
          return matches.length > 0 ? matches : null;
        }
        return null;
      };
      return handleMetaPage(eventList, evtId, extra);
    }
    case 'Search':
      return handleGlobalSearch(docs.allObjects, id || '');
  }
}

/**
 * Splits `<div class="doc-list">...</div>` content right after a doc card (`</table></div>`) once the budget is reached.
 * Doc tables are never nested, so the end of a card is always a safe boundary.
 */
function splitContent(html: string): { head: string; rest: string } {
  let inner = html;
  if (inner.startsWith(LIST_START)) inner = inner.slice(LIST_START.length);
  if (inner.endsWith(LIST_END)) inner = inner.slice(0, -LIST_END.length);

  if (inner.length <= HEAD_BUDGET_BYTES * 1.5) {
    return { head: `${LIST_START}${inner}${LIST_END}`, rest: '' };
  }
  const cut = inner.indexOf(DOC_CARD_END, HEAD_BUDGET_BYTES);
  if (cut === -1) {
    return { head: `${LIST_START}${inner}${LIST_END}`, rest: '' };
  }
  const splitAt = cut + DOC_CARD_END.length;
  return {
    head: `${LIST_START}${inner.slice(0, splitAt)}${LIST_END}`,
    rest: inner.slice(splitAt),
  };
}

export async function getDocModel(kind: DocKind, id: string | null): Promise<SplitDocModel> {
  const docs = await getMetaDocs();
  if (docs !== cacheDocs) {
    modelCache.clear();
    cacheDocs = docs;
  }
  const key = `${kind}|${id ?? ''}`;
  const hit = modelCache.get(key);
  if (hit) {
    modelCache.delete(key);
    modelCache.set(key, hit);
    return hit;
  }

  const model = buildModel(docs, kind, id);
  const { head, rest } = splitContent(model.contentHtml);
  const restEst = estimateRest(rest);
  const result: SplitDocModel = {
    ...model,
    contentHtml: '',
    headHtml: head,
    restHtml: rest,
    restEstFeatures: restEst.features,
    restEstExtraPx: restEst.extraPx,
  };

  modelCache.set(key, result);
  if (modelCache.size > MAX_CACHE_ENTRIES) {
    const oldest = modelCache.keys().next().value;
    if (oldest !== undefined) modelCache.delete(oldest);
  }
  return result;
}

export function restUrlFor(kind: DocKind, id: string | null, version: string): string {
  const params = new URLSearchParams({ kind, v: version, f: REST_FORMAT });
  if (id) params.set('id', id);
  return `/api/doc-rest?${params.toString()}`;
}

export const loadDocPage = cache(async (kind: DocKind, id: string | null) => {
  const [model, docs] = await Promise.all([getDocModel(kind, id), getMetaDocs()]);
  const version = String(docs.lastReload || '0').replace(/\W/g, '');
  const restUrl = model.restHtml ? restUrlFor(kind, id, version) : null;
  return { model, restUrl };
});

export function cleanPlainSummary(raw: string | undefined, maxLen = 220): string {
  if (!raw) return '';
  const cleaned = raw
    .replace(/\r/g, '')
    .replace(/<@link\s+[a-z]+\s+([^>]+)>/gi, '$1')
    .replace(/<\/?code>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, maxLen - 1).trimEnd() + '…';
}

/**
 * `canonicalPath` tells search engines which URL is the real one (the same page is reachable as /docs/..., with
 * different casing or encodings, and on preview domains). Pages that are only search results get `noindex`.
 */
function makeRichMeta(title: string, description: string, canonicalPath: string | null, indexable = true): Metadata {
  return {
    title,
    description,
    ...(canonicalPath ? { alternates: { canonical: canonicalPath } } : {}),
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      title,
      description,
      siteName: 'DenizenM Meta Documentation',
      type: 'article',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export async function buildDocPageMetadata(
  kind: DocKind,
  id: string | null,
  sectionLabel: string
): Promise<Metadata> {
  const docs = await getMetaDocs();
  const clean = id ? id.trim().toLowerCase() : '';

  if (!clean) {
    const countMap: Record<DocKind, number> = {
      Commands: Object.keys(docs.commands).length,
      Tags: Object.keys(docs.tags).length,
      Events: Object.keys(docs.events).length,
      Mechanisms: Object.keys(docs.mechanisms).length,
      Actions: Object.keys(docs.actions).length,
      Languages: Object.keys(docs.languages).length,
      ObjectTypes: Object.keys(docs.objectTypes).length,
      Search: docs.allObjects.length,
    };
    const count = countMap[kind];
    const title = `${sectionLabel} | DenizenM Meta Documentation`;
    const desc =
      kind === 'Search'
        ? `Search across all ${count.toLocaleString()} DenizenM commands, tags, events, mechanisms, actions, languages, and object types.`
        : `Browse all ${count.toLocaleString()} DenizenM ${sectionLabel.toLowerCase()} with syntax, async safety details, and script examples.`;
    return makeRichMeta(title, desc, `/Docs/${kind}`, kind !== 'Search');
  }

  if (kind === 'Commands') {
    const cmdKey = normalizeScriptQuery(clean).strippedCmd;
    const cmd = docs.commands[cmdKey];
    if (cmd) {
      const asyncInfo = getCommandAsyncStatus(cmd.name);
      const asyncLabel = asyncInfo.runsAsync
        ? 'Runs Off-Thread'
        : asyncInfo.deferrable
        ? 'Deferrable'
        : 'Main Thread';
      const title = `-${cmd.name} • Command (${asyncLabel}) | DenizenM Meta`;
      const desc = cleanPlainSummary(
        `${cmd.short || cmd.description}${cmd.syntax ? ` — Syntax: ${cmd.syntax}` : ''}`
      );
      return makeRichMeta(title, desc || `DenizenM command '${cmd.name}' documentation.`, hrefForSuggestion('Command', cmd.cleanName));
    }
  } else if (kind === 'Tags') {
    const tagKey = cleanTag(clean).trim();
    let tag =
      docs.tags[tagKey] ||
      Object.values(docs.tags).find((t) => t.cleanName.replace(/tag\./g, '.') === tagKey);
    if (!tag && tagKey.includes('.')) {
      const targets = expandInheritedQueries(tagKey);
      tag = targets.map((t) => docs.tags[t]).find(Boolean);
    }
    if (tag) {
      const asyncInfo = getTagAsyncStatus(tag.cleanedName || tag.cleanName, tag.beforeDot, tag.afterDotCleaned, tag.sourceFile);
      const asyncLabel = asyncInfo.isSafe ? 'Async-Safe' : 'Main Thread';
      const ret = tag.returns ? ` → ${tag.returns}` : '';
      const title = `${tag.tagFull}${ret} (${asyncLabel}) | DenizenM Meta`;
      const desc = cleanPlainSummary(tag.description);
      return makeRichMeta(title, desc || `DenizenM tag ${tag.tagFull} documentation.`, hrefForSuggestion('Tag', tag.cleanName));
    }
  } else if (kind === 'Mechanisms') {
    const mech =
      docs.mechanisms[clean] ||
      Object.values(docs.mechanisms).find((m) => m.mechName.toLowerCase() === clean);
    if (mech) {
      const inputPart = mech.input ? ` (${mech.input})` : '';
      const title = `${mech.fullName}${inputPart} • Mechanism | DenizenM Meta`;
      const desc = cleanPlainSummary(mech.description);
      return makeRichMeta(title, desc || `DenizenM mechanism ${mech.fullName} documentation.`, hrefForSuggestion('Mechanism', mech.cleanName));
    }
  } else if (kind === 'Events') {
    const evtKey = normalizeScriptQuery(clean).strippedEvent;
    const evt =
      docs.events[evtKey] ||
      Object.values(docs.events).find((e) => e.cleanEvents.some((ce) => ce === evtKey));
    if (evt) {
      const title = `on ${evt.cleanName} • Event | DenizenM Meta`;
      const desc = cleanPlainSummary(
        `${evt.triggers}${evt.cancellable ? ' (Cancellable)' : ''}`
      );
      return makeRichMeta(title, desc || `DenizenM event '${evt.cleanName}' documentation.`, hrefForSuggestion('Event', evt.cleanName));
    }
  } else if (kind === 'ObjectTypes') {
    const ot = docs.objectTypes[clean] || docs.objectTypes[clean + 'tag'];
    if (ot) {
      const otAsync = getObjectTypeAsyncStatus(ot.typeName || ot.cleanName);
      const asyncLabel = otAsync.isFullSafe
        ? 'Fully Async-Safe'
        : otAsync.isPartial
        ? `Partial Async-Safe`
        : 'Main Thread Only';
      const prefixLabel = ot.prefix && ot.prefix !== 'none' ? ` (${ot.prefix}@)` : '';
      const title = `${ot.name}${prefixLabel} • ObjectType (${asyncLabel}) | DenizenM Meta`;
      const desc = cleanPlainSummary(ot.description);
      return makeRichMeta(title, desc || `DenizenM object type ${ot.name} documentation.`, hrefForSuggestion('ObjectType', ot.cleanName));
    }
  } else if (kind === 'Languages') {
    const lang = docs.languages[clean];
    if (lang) {
      const title = `${lang.name} • Language Guide | DenizenM Meta`;
      const desc = cleanPlainSummary(lang.description);
      return makeRichMeta(title, desc || `DenizenM language explanation: ${lang.name}.`, hrefForSuggestion('Language', lang.cleanName));
    }
  } else if (kind === 'Actions') {
    const actKey = normalizeScriptQuery(clean).strippedEvent;
    const act = docs.actions[actKey] || docs.actions['on ' + actKey];
    if (act) {
      const title = `${act.name} • NPC Action | DenizenM Meta`;
      const desc = cleanPlainSummary(act.triggers);
      return makeRichMeta(title, desc || `DenizenM NPC action '${act.name}' documentation.`, hrefForSuggestion('Action', act.cleanName));
    }
  }

  const fallbackTitle = `Search '${id}' | ${sectionLabel} | DenizenM Meta Documentation`;
  const fallbackDesc = `${sectionLabel} matching '${id}' in DenizenM Meta Documentation.`;
  // Not an exact entry: a search-results page. Keep it out of the index; the entries themselves are in the sitemap.
  return makeRichMeta(fallbackTitle, fallbackDesc, null, false);
}
