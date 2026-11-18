'use client';

import { useEffect, useRef } from 'react';
import { tryFlushPendingFlash } from '@/lib/flasher';
import {
  parseRestChunks,
  registerDocRestController,
  restCardMatches,
  unregisterDocRestController,
  type DocRestController,
} from '@/lib/doc-rest-registry';

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

const CHUNK_BYTES = 140_000;
const MOUNT_ROOT_MARGIN = '2200px 0px';
const MOUNT_VIEWPORT_BUFFER = 2200;
const RECYCLE_DISTANCE_PX = 8000;
const MAX_MOUNTED_CHUNKS = 8;

function estimateChunkHeight(cardCount: number): string {
  return `${Math.max(180, cardCount * 290)}px`;
}

export function DocRestLoader({
  url,
  containerId = 'doc-entries-root',
  onChunksUpdated,
}: {
  url: string;
  containerId?: string;
  onChunksUpdated?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = '';
    let cancelled = false;
    let observer: IntersectionObserver | null = null;
    let registeredCtrl: DocRestController | null = null;

    loadRest(url)
      .then((html) => {
        if (cancelled || !html) return;

        const root = document.getElementById(containerId);
        const headHeaders = root?.querySelectorAll<HTMLElement>(
          '.doc-head .category_header_block'
        );
        const initialCatId =
          headHeaders && headHeaders.length > 0
            ? headHeaders[headHeaders.length - 1].dataset.categoryHeader || ''
            : '';

        const { chunks, idToChunk } = parseRestChunks(html, initialCatId, CHUNK_BYTES);
        if (chunks.length === 0) return;

        const chunkEls: HTMLDivElement[] = [];
        const frag = document.createDocumentFragment();
        for (const chunk of chunks) {
          const el = document.createElement('div');
          el.className = 'doc-rest-chunk';
          el.dataset.chunkIndex = String(chunk.index);
          el.style.minHeight = estimateChunkHeight(chunk.cards.length);
          chunkEls.push(el);
          frag.appendChild(el);
        }
        host.appendChild(frag);

        const mountedSet = new Set<number>();
        let lastAnchorJumpAt = 0;
        let activeIsFiltering = false;
        let activeVisibleCats = new Set<string>();

        const syncChunkHeaders = (el: HTMLElement) => {
          el.querySelectorAll<HTMLElement>('.category_header_block').forEach((hdr) => {
            const catId = hdr.dataset.categoryHeader || '';
            hdr.style.display =
              !activeIsFiltering || activeVisibleCats.has(catId) ? '' : 'none';
          });
        };

        const mountChunk = (idx: number): boolean => {
          if (idx < 0 || idx >= chunks.length) return false;
          if (mountedSet.has(idx)) return true;
          mountedSet.add(idx);
          const el = chunkEls[idx];
          el.innerHTML = chunks[idx].html;
          el.style.minHeight = '';
          observer?.unobserve(el);
          syncChunkHeaders(el);
          return true;
        };

        const recycleDistantChunks = () => {
          if (mountedSet.size <= MAX_MOUNTED_CHUNKS) return;
          if (performance.now() - lastAnchorJumpAt <= 800) return;
          const vh = window.innerHeight || 900;
          for (const idx of [...mountedSet]) {
            if (idx === 0) continue;
            const el = chunkEls[idx];
            const rect = el.getBoundingClientRect();
            if (rect.bottom < -RECYCLE_DISTANCE_PX || rect.top > vh + RECYCLE_DISTANCE_PX) {
              const measuredH = el.offsetHeight;
              if (measuredH > 0) {
                el.style.minHeight = `${measuredH}px`;
              }
              el.innerHTML = '';
              mountedSet.delete(idx);
              observer?.observe(el);
              if (mountedSet.size <= MAX_MOUNTED_CHUNKS) break;
            }
          }
        };

        const ensureAnchorMounted = (rawId: string): boolean => {
          const idx = idToChunk.get(rawId);
          if (idx === undefined) return false;
          lastAnchorJumpAt = performance.now();
          if (idx > 0) mountChunk(idx - 1);
          mountChunk(idx);
          if (idx + 1 < chunks.length) mountChunk(idx + 1);
          return true;
        };

        const applyFilterState = (
          asyncFilter: string,
          pluginFilter: string,
          visibleCategories: Set<string>
        ) => {
          activeIsFiltering = Boolean(asyncFilter || pluginFilter);
          activeVisibleCats = visibleCategories;
          const vh = window.innerHeight || 900;

          for (const chunk of chunks) {
            const el = chunkEls[chunk.index];
            if (!activeIsFiltering) {
              el.style.display = '';
              if (mountedSet.has(chunk.index)) {
                syncChunkHeaders(el);
              } else {
                el.style.minHeight = estimateChunkHeight(chunk.cards.length);
                const rect = el.getBoundingClientRect();
                if (rect.bottom >= -MOUNT_VIEWPORT_BUFFER && rect.top <= vh + MOUNT_VIEWPORT_BUFFER) {
                  mountChunk(chunk.index);
                }
              }
            } else {
              let matched = 0;
              for (const card of chunk.cards) {
                if (restCardMatches(card, asyncFilter, pluginFilter)) matched++;
              }
              const hasVisHdr = chunk.headerCatIds.some((id) => visibleCategories.has(id));
              if (matched === 0 && !hasVisHdr) {
                el.style.display = 'none';
              } else {
                el.style.display = '';
                if (mountedSet.has(chunk.index)) {
                  syncChunkHeaders(el);
                } else {
                  el.style.minHeight = `${Math.max(80, matched * 280 + (hasVisHdr ? 64 : 0))}px`;
                  const rect = el.getBoundingClientRect();
                  if (
                    rect.bottom >= -MOUNT_VIEWPORT_BUFFER &&
                    rect.top <= vh + MOUNT_VIEWPORT_BUFFER
                  ) {
                    mountChunk(chunk.index);
                  }
                }
              }
            }
          }
        };

        const ctrl: DocRestController = {
          containerId,
          chunks,
          idToChunk,
          mountChunk,
          ensureAnchorMounted,
          applyFilterState,
        };
        registeredCtrl = ctrl;
        registerDocRestController(containerId, ctrl);

        if (typeof IntersectionObserver !== 'undefined') {
          observer = new IntersectionObserver(
            (entries) => {
              let mountedAny = false;
              for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const el = entry.target as HTMLElement;
                if (el.style.display === 'none') continue;
                const idx = Number(el.dataset.chunkIndex);
                if (!Number.isNaN(idx) && mountChunk(idx)) {
                  mountedAny = true;
                }
              }
              if (mountedAny) {
                recycleDistantChunks();
              }
            },
            { rootMargin: MOUNT_ROOT_MARGIN }
          );
          for (let i = 1; i < chunkEls.length; i++) {
            observer.observe(chunkEls[i]);
          }
        }

        // Mount the first follow-up chunk right away so initial scroll below head is seamless.
        mountChunk(0);

        // If user navigated via `#hash` or clicked a category chip early, mount & jump immediately.
        tryFlushPendingFlash();
        onChunksUpdated?.();
        window.dispatchEvent(new CustomEvent('agy:doc-rest-loaded'));
      })
      .catch((e) => console.error('Failed to load remaining docs:', e));

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (registeredCtrl) {
        unregisterDocRestController(containerId, registeredCtrl);
      }
      if (host) host.innerHTML = '';
    };
  }, [url, containerId, onChunksUpdated]);

  return <div ref={hostRef} className="doc-rest doc-list" aria-live="off" />;
}
