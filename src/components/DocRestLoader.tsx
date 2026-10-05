'use client';

import { useEffect, useRef } from 'react';

// Session-level cache so revisiting a tab never re-downloads its content.
const restCache = new Map<string, Promise<string>>();

function loadRest(url: string): Promise<string> {
  let p = restCache.get(url);
  if (!p) {
    p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    });
    p.catch(() => restCache.delete(url));
    restCache.set(url, p);
  }
  return p;
}

/** Splits HTML into pieces at top-level `</table>` boundaries (~CHUNK bytes each). */
function chunkHtml(html: string, size: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < html.length) {
    if (html.length - start <= size) {
      chunks.push(html.slice(start));
      break;
    }
    const cut = html.indexOf('</table>', start + size);
    const end = cut === -1 ? html.length : cut + '</table>'.length;
    chunks.push(html.slice(start, end));
    start = end;
  }
  return chunks;
}

const CHUNK_BYTES = 250_000;
/** Don't touch the DOM while the page-enter animation is running. */
const ENTER_ANIMATION_MS = 300;

export function DocRestLoader({ url }: { url: string }) {
  const hostRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const mountedAt = performance.now();

    loadRest(url)
      .then(async (html) => {
        const wait = ENTER_ANIMATION_MS - (performance.now() - mountedAt);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));

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
            (window as unknown as { doFlashFor?: (id: string) => void }).doFlashFor?.(id);
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
