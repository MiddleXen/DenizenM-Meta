'use client';

import { useEffect, useRef } from 'react';
import { tryFlushPendingFlash } from '@/lib/flasher';

// Bounded (LRU) session cache so revisiting a tab never re-downloads its content.
const MAX_CACHED_PAGES = 6;
const restCache = new Map<string, Promise<string>>();

function loadRest(url: string): Promise<string> {
  let p = restCache.get(url);
  if (p) {
    restCache.delete(url);
    restCache.set(url, p);
    return p;
  }
  p = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  });
  p.catch(() => {
    if (restCache.get(url) === p) restCache.delete(url);
  });
  restCache.set(url, p);
  while (restCache.size > MAX_CACHED_PAGES) {
    const oldest = restCache.keys().next().value;
    if (oldest === undefined) break;
    restCache.delete(oldest);
  }
  return p;
}

/** Every entry ends with this (see `wrapDocCard` in meta-store), so cutting there never splits a card. */
const CARD_END = '</table></div>';

/** Splits HTML into pieces at doc-card boundaries (~CHUNK bytes each). */
function chunkHtml(html: string, size: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < html.length) {
    if (html.length - start <= size) {
      chunks.push(html.slice(start));
      break;
    }
    const cut = html.indexOf(CARD_END, start + size);
    const end = cut === -1 ? html.length : cut + CARD_END.length;
    chunks.push(html.slice(start, end));
    start = end;
  }
  return chunks;
}

const CHUNK_BYTES = 250_000;

export function DocRestLoader({
  url,
  onChunksUpdated,
}: {
  url: string;
  onChunksUpdated?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = '';
    let cancelled = false;
    let flushedAnchor = false;

    loadRest(url)
      .then(async (html) => {
        for (const chunk of chunkHtml(html, CHUNK_BYTES)) {
          if (cancelled) return;
          host.insertAdjacentHTML('beforeend', chunk);

          // Resolve deep `#hash` or clicked category chip as soon as its chunk arrives!
          if (!flushedAnchor && tryFlushPendingFlash()) {
            flushedAnchor = true;
          }

          // Yield to the browser between chunks so scrolling/input stay smooth.
          await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        }
        if (cancelled) return;

        if (!flushedAnchor) {
          tryFlushPendingFlash();
        }
        onChunksUpdated?.();
        window.dispatchEvent(new CustomEvent('agy:doc-rest-loaded'));
      })
      .catch((e) => console.error('Failed to load remaining docs:', e));

    return () => {
      cancelled = true;
    };
  }, [url, onChunksUpdated]);

  return <div ref={hostRef} className="doc-list doc-rest" suppressHydrationWarning />;
}
