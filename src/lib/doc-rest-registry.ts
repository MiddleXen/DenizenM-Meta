import { FEATURES_STYLE_RE_SRC, type HeightFeatures } from './card-height';

/**
 * Client-side controller registry for demand-mounted `DocRestLoader` chunks.
 * Keeps large sections (e.g. 2,512 Tags / ~102k DOM nodes) lightweight on the main thread
 * while preserving instant exact filtering, category scoping, and `#hash` navigation.
 */

export interface RestCardMeta {
  catId: string;
  asyncTokens: string[];
  plugin: string;
  /** Height features (see card-height.ts), from the card's style attribute. */
  f: HeightFeatures;
}

export interface RestChunkMeta {
  index: number;
  html: string;
  cards: RestCardMeta[];
  headerCatIds: string[];
  /** Sum of the cards' height features. */
  sumF: HeightFeatures;
}

export interface DocRestController {
  containerId: string;
  chunks: RestChunkMeta[];
  idToChunk: Map<string, number>;
  mountChunk: (idx: number) => boolean;
  ensureAnchorMounted: (rawId: string) => boolean;
  applyFilterState: (
    asyncFilter: string,
    pluginFilter: string,
    visibleCategories: Set<string>
  ) => void;
}

const CARD_END = '</table></div>';

/** Features for cards without any (older markup): 340px of "text", matching the CSS default. */
const FALLBACK_FEATURES: HeightFeatures = [0, 0, 0, 340];

const decodeBasicAttr = (s: string): string =>
  s.includes('&')
    ? s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    : s;

export function restCardMatches(
  card: RestCardMeta,
  asyncFilter: string,
  pluginFilter: string
): boolean {
  if (asyncFilter && !card.asyncTokens.includes(asyncFilter)) return false;
  if (pluginFilter && card.plugin !== pluginFilter) return false;
  return true;
}

function splitRestHtml(html: string, chunkBytes: number): string[] {
  const parts: string[] = [];
  let start = 0;
  while (start < html.length) {
    if (html.length - start <= chunkBytes) {
      parts.push(html.slice(start));
      break;
    }
    const cut = html.indexOf(CARD_END, start + chunkBytes);
    const end = cut === -1 ? html.length : cut + CARD_END.length;
    parts.push(html.slice(start, end));
    start = end;
  }
  return parts;
}

export function parseRestChunks(
  html: string,
  initialCatId: string,
  chunkBytes = 140_000
): { chunks: RestChunkMeta[]; idToChunk: Map<string, number> } {
  const rawChunks = splitRestHtml(html, chunkBytes);
  const chunks: RestChunkMeta[] = [];
  const idToChunk = new Map<string, number>();
  let currentCatId = initialCatId;

  const tokenRe = new RegExp(
    String.raw`data-category-header="([^"]+)"|<div class="doc-card"(?: data-async="([^"]*)")? data-plugin="([^"]+)"(?: ${FEATURES_STYLE_RE_SRC})?[^>]*>|\bid="([^"]+)"`,
    'g'
  );

  for (let idx = 0; idx < rawChunks.length; idx++) {
    const chunkHtml = rawChunks[idx];
    const cards: RestCardMeta[] = [];
    const headerCatIds: string[] = [];
    const sumF: HeightFeatures = [0, 0, 0, 0];

    tokenRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = tokenRe.exec(chunkHtml)) !== null) {
      if (m[1] !== undefined) {
        currentCatId = decodeBasicAttr(m[1]);
        headerCatIds.push(currentCatId);
      } else if (m[3] !== undefined) {
        const asyncRaw = m[2];
        const f: HeightFeatures = m[4]
          ? [Number(m[4]), Number(m[5]), Number(m[6]), Number(m[7])]
          : FALLBACK_FEATURES;
        for (let i = 0; i < 4; i++) sumF[i] += f[i];
        cards.push({
          catId: currentCatId,
          asyncTokens: asyncRaw ? asyncRaw.split(/\s+/).filter(Boolean) : [],
          plugin: m[3],
          f,
        });
      } else if (m[8] !== undefined) {
        const idRaw = decodeBasicAttr(m[8]);
        idToChunk.set(idRaw, idx);
        try {
          const decoded = decodeURIComponent(idRaw);
          if (decoded !== idRaw) {
            idToChunk.set(decoded, idx);
          }
        } catch {
          // Ignore malformed URI sequences in anchor IDs.
        }
      }
    }

    chunks.push({
      index: idx,
      html: chunkHtml,
      cards,
      headerCatIds,
      sumF,
    });
  }

  return { chunks, idToChunk };
}

const controllers = new Map<string, DocRestController>();

export function registerDocRestController(
  containerId: string,
  ctrl: DocRestController
): void {
  controllers.set(containerId, ctrl);
}

export function unregisterDocRestController(
  containerId: string,
  ctrl: DocRestController
): void {
  if (controllers.get(containerId) === ctrl) {
    controllers.delete(containerId);
  }
}

export function getDocRestController(
  containerId: string
): DocRestController | undefined {
  return controllers.get(containerId);
}

export function ensureAnyRestAnchorMounted(...candidates: string[]): boolean {
  for (const ctrl of controllers.values()) {
    for (const candidate of candidates) {
      if (candidate && ctrl.ensureAnchorMounted(candidate)) {
        return true;
      }
    }
  }
  return false;
}
