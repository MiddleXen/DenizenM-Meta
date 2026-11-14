'use client';

import { useEffect, useRef } from 'react';
import { doFlashFor } from '@/lib/flasher';

// Session-level cache so revisiting a tab never re-downloads its content.
// Bounded (LRU): a single big page is several MB of HTML, so keeping every page ever visited
// for the whole session would only grow memory.
const MAX_CACHED_PAGES = 6;
const restCache = new Map<string, Promise<string>>();

function loadRest(url: string): Promise<string> {
  let p = restCache.get(url);
  if (p) {
    // Refresh recency.
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

export function DocRestLoader({ url }: { url: string }) {
  const hostRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    loadRest(url)
      .then(async (html) => {
        for (const chunk of chunkHtml(html, CHUNK_BYTES)) {
          if (cancelled) return;
          host.insertAdjacentHTML('beforeend', chunk);
          // Yield to the browser between chunks so scrolling/input stay smooth.
          await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
        }
        if (cancelled) return;

        // Deep links (#anchor) to entries that live in the deferred part.
        const hash = window.location.hash;
        if (hash.length > 1) {
          const id = decodeURIComponent(hash.slice(1));
          const target = document.getElementById(id);
          if (target && host.contains(target)) {
            doFlashFor(id);
          }
        }
      })
      .catch((e) => console.error('Failed to load remaining docs:', e));

    return () => {
      cancelled = true;
    };
  }, [url]);

  // `<center>` matches how the head part is wrapped; React never renders children here.
  return <center ref={hostRef} suppressHydrationWarning />;
}
