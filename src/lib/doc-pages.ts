import { cache } from 'react';
import type { Metadata } from 'next';
import { DOC_CARD_END, getMetaDocs, handleGlobalSearch, handleMetaPage } from './meta-store';
import {
  getCommandAsyncStatus,
  getObjectTypeAsyncStatus,
  getTagAsyncStatus,
} from './async-safety';
import { cleanTag } from './util';
import { DocViewModel, MetaDocsData, MetaEventObject } from './types';

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
const REST_FORMAT = '4';

const LIST_START = '<div class="doc-list">';
const LIST_END = '</div>';

export interface SplitDocModel extends DocViewModel {
  headHtml: string;
  restHtml: string;
}

// Cache is bound to the docs object identity, so a meta reload invalidates everything automatically.
let cacheDocs: MetaDocsData | null = null;
const modelCache = new Map<string, SplitDocModel>();

function buildModel(docs: MetaDocsData, kind: DocKind, id: string | null): DocViewModel {
  switch (kind) {
    case 'Commands':
      return handleMetaPage(Object.values(docs.commands), id);
    case 'Tags':
      return handleMetaPage(Object.values(docs.tags), id ? cleanTag(id) : null);
    case 'Mechanisms':
      return handleMetaPage(Object.values(docs.mechanisms), id);
    case 'Actions':
      return handleMetaPage(Object.values(docs.actions), id);
    case 'Languages':
      return handleMetaPage(Object.values(docs.languages), id);
    case 'ObjectTypes':
      return handleMetaPage(Object.values(docs.objectTypes), id);
    case 'Events': {
      const eventList = Object.values(docs.events);
      const extra = (current: MetaEventObject[]): MetaEventObject[] | null => {
        if (current.length > 0 || !id) return null;
        const clean = id.toLowerCase();
        const matches = eventList.filter((e) => e.cleanEvents.some((ce) => ce.includes(clean)));
        return matches.length > 0 ? matches : null;
      };
      return handleMetaPage(eventList, id, extra);
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
  const result: SplitDocModel = { ...model, contentHtml: '', headHtml: head, restHtml: rest };

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

function cleanPlainSummary(raw: string | undefined, maxLen = 220): string {
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

function makeRichMeta(title: string, description: string): Metadata {
  return {
    title,
    description,
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
    return makeRichMeta(title, desc);
  }

  if (kind === 'Commands') {
    const cmd = docs.commands[clean];
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
      return makeRichMeta(title, desc || `DenizenM command '${cmd.name}' documentation.`);
    }
  } else if (kind === 'Tags') {
    const tagKey = cleanTag(clean);
    const tag =
      docs.tags[tagKey] ||
      Object.values(docs.tags).find((t) => t.cleanName.replace(/tag\./g, '.') === tagKey);
    if (tag) {
      const asyncInfo = getTagAsyncStatus(tag.cleanedName || tag.cleanName, tag.beforeDot, tag.afterDotCleaned);
      const asyncLabel = asyncInfo.isSafe ? 'Async-Safe' : 'Main Thread';
      const ret = tag.returns ? ` → ${tag.returns}` : '';
      const title = `${tag.tagFull}${ret} (${asyncLabel}) | DenizenM Meta`;
      const desc = cleanPlainSummary(tag.description);
      return makeRichMeta(title, desc || `DenizenM tag ${tag.tagFull} documentation.`);
    }
  } else if (kind === 'Mechanisms') {
    const mech =
      docs.mechanisms[clean] ||
      Object.values(docs.mechanisms).find((m) => m.mechName.toLowerCase() === clean);
    if (mech) {
      const inputPart = mech.input ? ` (${mech.input})` : '';
      const title = `${mech.fullName}${inputPart} • Mechanism | DenizenM Meta`;
      const desc = cleanPlainSummary(mech.description);
      return makeRichMeta(title, desc || `DenizenM mechanism ${mech.fullName} documentation.`);
    }
  } else if (kind === 'Events') {
    const evt =
      docs.events[clean] ||
      Object.values(docs.events).find((e) => e.cleanEvents.some((ce) => ce === clean));
    if (evt) {
      const title = `on ${evt.cleanName} • Event | DenizenM Meta`;
      const desc = cleanPlainSummary(
        `${evt.triggers}${evt.cancellable ? ' (Cancellable)' : ''}`
      );
      return makeRichMeta(title, desc || `DenizenM event '${evt.cleanName}' documentation.`);
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
      return makeRichMeta(title, desc || `DenizenM object type ${ot.name} documentation.`);
    }
  } else if (kind === 'Languages') {
    const lang = docs.languages[clean];
    if (lang) {
      const title = `${lang.name} • Language Guide | DenizenM Meta`;
      const desc = cleanPlainSummary(lang.description);
      return makeRichMeta(title, desc || `DenizenM language explanation: ${lang.name}.`);
    }
  } else if (kind === 'Actions') {
    const act = docs.actions[clean] || docs.actions['on ' + clean];
    if (act) {
      const title = `${act.name} • NPC Action | DenizenM Meta`;
      const desc = cleanPlainSummary(act.triggers);
      return makeRichMeta(title, desc || `DenizenM NPC action '${act.name}' documentation.`);
    }
  }

  const fallbackTitle = `Search '${id}' | ${sectionLabel} | DenizenM Meta Documentation`;
  const fallbackDesc = `${sectionLabel} matching '${id}' in DenizenM Meta Documentation.`;
  return makeRichMeta(fallbackTitle, fallbackDesc);
}
