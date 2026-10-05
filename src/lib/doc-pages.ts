import { getMetaDocs, handleGlobalSearch, handleMetaPage } from './meta-store';
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

export interface SplitDocModel extends DocViewModel {
  headHtml: string;
  restHtml: string;
}

// Cache is bound to the docs object identity, so a meta reload invalidates everything automatically.
let cacheDocs: MetaDocsData | null = null;
const cache = new Map<string, SplitDocModel>();

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
 * Splits `<center>...</center>` content right after a top-level `</table>` once the budget is reached.
 * Doc tables are never nested, so `</table>` is always a safe boundary.
 */
function splitContent(html: string): { head: string; rest: string } {
  let inner = html;
  if (inner.startsWith('<center>')) inner = inner.slice('<center>'.length);
  if (inner.endsWith('</center>')) inner = inner.slice(0, -'</center>'.length);

  if (inner.length <= HEAD_BUDGET_BYTES * 1.5) {
    return { head: `<center>${inner}</center>`, rest: '' };
  }
  const cut = inner.indexOf('</table>', HEAD_BUDGET_BYTES);
  if (cut === -1) {
    return { head: `<center>${inner}</center>`, rest: '' };
  }
  const splitAt = cut + '</table>'.length;
  return {
    head: `<center>${inner.slice(0, splitAt)}</center>`,
    rest: inner.slice(splitAt),
  };
}

export async function getDocModel(kind: DocKind, id: string | null): Promise<SplitDocModel> {
  const docs = await getMetaDocs();
  if (docs !== cacheDocs) {
    cache.clear();
    cacheDocs = docs;
  }
  const key = `${kind}|${id ?? ''}`;
  const hit = cache.get(key);
  if (hit) {
    // refresh LRU position
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }

  const model = buildModel(docs, kind, id);
  const { head, rest } = splitContent(model.contentHtml);
  const result: SplitDocModel = { ...model, contentHtml: '', headHtml: head, restHtml: rest };

  cache.set(key, result);
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return result;
}

export function restUrlFor(kind: DocKind, id: string | null, version: string): string {
  const params = new URLSearchParams({ kind, v: version });
  if (id) params.set('id', id);
  return `/api/doc-rest?${params.toString()}`;
}

export async function loadDocPage(kind: DocKind, id: string | null) {
  const model = await getDocModel(kind, id);
  const docs = await getMetaDocs();
  const version = String(docs.lastReload || '0').replace(/\W/g, '');
  const restUrl = model.restHtml ? restUrlFor(kind, id, version) : null;
  return { model, restUrl };
}
