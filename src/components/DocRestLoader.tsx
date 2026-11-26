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
import {
  COEFF_CSS_VARS,
  FEATURE_CSS_VARS,
  HeightCalibrator,
  predictHeight,
  priorCoeffs,
  type HeightCoeffs,
  type HeightFeatures,
} from '@/lib/card-height';

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

/** Vertical gap between cards (`.doc-card` margin, collapsed) and the height of a category header block. */
const CARD_GAP_PX = 16;
const CATEGORY_HEADER_PX = 64;
/** Stop calibrating once this much real card height has been measured. */
const CALIBRATION_TARGET_PX = 60_000;
/** Re-apply coefficients only when they move the predicted height of what is left by more than this. */
const REAPPLY_THRESHOLD = 0.015;

/**
 * Starting coefficients for this screen: from the width of a rendered card's value column (the head's first cards are
 * always rendered), or the CSS fallbacks on the container when there is none.
 */
function layoutPrior(root: HTMLElement | null): HeightCoeffs {
  const firstRow = root?.querySelector<HTMLTableRowElement>('.doc-card tr');
  const cells = firstRow ? firstRow.querySelectorAll<HTMLTableCellElement>(':scope > td') : null;
  if (cells && cells.length > 1) {
    const keyW = cells[0].getBoundingClientRect().width;
    const valueW = cells[1].getBoundingClientRect().width;
    if (valueW > 0) return priorCoeffs(valueW, keyW >= valueW * 0.9);
  }
  if (root) {
    const cs = getComputedStyle(root);
    const k = COEFF_CSS_VARS.map((v) => Number(cs.getPropertyValue(v)));
    if (k.every((v) => v > 0)) return k as HeightCoeffs;
  }
  return priorCoeffs(0, false);
}

function applyCoeffVars(root: HTMLElement | null, k: HeightCoeffs): void {
  if (!root) return;
  COEFF_CSS_VARS.forEach((name, i) => root.style.setProperty(name, k[i].toFixed(3)));
}

type CheckVisibilityEl = HTMLElement & { checkVisibility?: (opts?: { contentVisibilityAuto?: boolean }) => boolean };

/** True when the card is actually laid out (not skipped by `content-visibility: auto`), ie its height is real. */
function isCardRendered(card: CheckVisibilityEl, rect: DOMRect, vh: number): boolean {
  if (typeof card.checkVisibility === 'function') return card.checkVisibility({ contentVisibilityAuto: true });
  return rect.top < vh && rect.bottom > 0;
}

function readCardFeatures(card: HTMLElement): HeightFeatures | null {
  const f = FEATURE_CSS_VARS.map((v) => Number(card.style.getPropertyValue(v)));
  return f.every((v) => Number.isFinite(v)) && f.some((v) => v > 0) ? (f as HeightFeatures) : null;
}

export function DocRestLoader({
  url,
  containerId = 'doc-entries-root',
  estimateFeatures = '',
  estimateExtraPx = 0,
  onChunksUpdated,
}: {
  url: string;
  containerId?: string;
  /**
   * Summed height features ("r,c,p,x") of the rest, plus its fixed gaps/headers: the space is reserved before the
   * rest is fetched, so the page (and the scrollbar thumb) has its final size from the first paint.
   */
  estimateFeatures?: string;
  estimateExtraPx?: number;
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
    let detachCalibration: (() => void) | null = null;

    const root = document.getElementById(containerId);
    // The reserved space (style below) follows these CSS variables, so it is corrected right away too.
    const prior = layoutPrior(root);
    applyCoeffVars(root, prior);

    loadRest(url)
      .then((html) => {
        if (cancelled || !html) return;

        const headHeaders = root?.querySelectorAll<HTMLElement>(
          '.doc-head .category_header_block'
        );
        const initialCatId =
          headHeaders && headHeaders.length > 0
            ? headHeaders[headHeaders.length - 1].dataset.categoryHeader || ''
            : '';

        const { chunks, idToChunk } = parseRestChunks(html, initialCatId, CHUNK_BYTES);
        if (chunks.length === 0) return;

        let coeffs = prior;
        // Exact heights of chunks that were mounted once and then recycled.
        const measuredHeights: Array<number | undefined> = new Array(chunks.length);

        const estimatePx = (idx: number, k: HeightCoeffs = coeffs): number => {
          const chunk = chunks[idx];
          return Math.max(
            80,
            Math.round(
              predictHeight(chunk.sumF, k) +
                chunk.cards.length * CARD_GAP_PX +
                chunk.headerCatIds.length * CATEGORY_HEADER_PX
            )
          );
        };
        const placeholderPx = (idx: number): number => measuredHeights[idx] ?? estimatePx(idx);

        const chunkEls: HTMLDivElement[] = [];
        const frag = document.createDocumentFragment();
        for (const chunk of chunks) {
          const el = document.createElement('div');
          el.className = 'doc-rest-chunk';
          el.dataset.chunkIndex = String(chunk.index);
          el.style.minHeight = `${placeholderPx(chunk.index)}px`;
          chunkEls.push(el);
          frag.appendChild(el);
        }
        host.appendChild(frag);
        host.style.minHeight = '';

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
                if (!activeIsFiltering) measuredHeights[idx] = measuredH;
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
                el.style.minHeight = `${placeholderPx(chunk.index)}px`;
                const rect = el.getBoundingClientRect();
                if (rect.bottom >= -MOUNT_VIEWPORT_BUFFER && rect.top <= vh + MOUNT_VIEWPORT_BUFFER) {
                  mountChunk(chunk.index);
                }
              }
            } else {
              let matched = 0;
              let matchedH = 0;
              for (const card of chunk.cards) {
                if (restCardMatches(card, asyncFilter, pluginFilter)) {
                  matched++;
                  matchedH += predictHeight(card.f, coeffs);
                }
              }
              const hasVisHdr = chunk.headerCatIds.some((id) => visibleCategories.has(id));
              if (matched === 0 && !hasVisHdr) {
                el.style.display = 'none';
              } else {
                el.style.display = '';
                if (mountedSet.has(chunk.index)) {
                  syncChunkHeaders(el);
                } else {
                  el.style.minHeight = `${Math.max(
                    80,
                    Math.round(matchedH + matched * CARD_GAP_PX + (hasVisHdr ? CATEGORY_HEADER_PX : 0))
                  )}px`;
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

        // --- Height calibration: fit the height model to cards that have really been rendered. ---
        const sampled = new WeakSet<Element>();
        const calibrator = new HeightCalibrator(prior);

        const sampleScope = (scope: Element, vh: number) => {
          scope.querySelectorAll<HTMLElement>('.doc-card').forEach((card) => {
            if (sampled.has(card)) return;
            const rect = card.getBoundingClientRect();
            if (rect.height <= 0 || !isCardRendered(card, rect, vh)) return;
            const f = readCardFeatures(card);
            sampled.add(card);
            if (f) calibrator.add(f, rect.height);
          });
        };

        const applyCoeffs = (next: HeightCoeffs) => {
          coeffs = next;
          applyCoeffVars(root, next);
          if (activeIsFiltering) return;
          // Only resize placeholders below the viewport, so nothing on screen moves.
          const vh = window.innerHeight || 900;
          for (let i = 0; i < chunkEls.length; i++) {
            if (mountedSet.has(i) || measuredHeights[i] !== undefined) continue;
            const el = chunkEls[i];
            if (el.getBoundingClientRect().top > vh) el.style.minHeight = `${placeholderPx(i)}px`;
          }
        };

        const calibrate = () => {
          if (cancelled || calibrator.sampledPx >= CALIBRATION_TARGET_PX) return;
          const vh = window.innerHeight || 900;
          // The head's first cards are always rendered (see .doc-head CSS), so the first pass already has data.
          const head = root?.querySelector('.doc-head');
          if (head) sampleScope(head, vh);
          for (const idx of mountedSet) {
            const r = chunkEls[idx].getBoundingClientRect();
            if (r.bottom > -vh && r.top < vh * 2) sampleScope(chunkEls[idx], vh);
          }
          if (calibrator.samples < 4) return; // need a few cards before trusting the fit
          const next = calibrator.solve();
          // Compare on what is still estimated: the not-yet-measured chunks.
          let before = 0;
          let after = 0;
          for (let i = 0; i < chunks.length; i++) {
            if (measuredHeights[i] !== undefined) continue;
            before += estimatePx(i, coeffs);
            after += estimatePx(i, next);
          }
          if (before > 0 && Math.abs(after - before) / before > REAPPLY_THRESHOLD) applyCoeffs(next);
          if (calibrator.sampledPx >= CALIBRATION_TARGET_PX) detachCalibration?.();
        };

        // Throttled while scrolling (a long flick never goes idle) plus once more when scrolling stops.
        let idleTimer: ReturnType<typeof setTimeout> | null = null;
        let lastCalibrateAt = 0;
        const onScroll = () => {
          const now = performance.now();
          if (now - lastCalibrateAt > 400) {
            lastCalibrateAt = now;
            requestAnimationFrame(calibrate);
          }
          if (idleTimer) clearTimeout(idleTimer);
          idleTimer = setTimeout(() => requestAnimationFrame(calibrate), 180);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        detachCalibration = () => {
          window.removeEventListener('scroll', onScroll);
          if (idleTimer) clearTimeout(idleTimer);
          detachCalibration = null;
        };
        requestAnimationFrame(() => requestAnimationFrame(calibrate));

        // If user navigated via `#hash` or clicked a category chip early, mount & jump immediately.
        tryFlushPendingFlash();
        onChunksUpdated?.();
        window.dispatchEvent(new CustomEvent('agy:doc-rest-loaded'));
      })
      .catch((e) => console.error('Failed to load remaining docs:', e));

    return () => {
      cancelled = true;
      detachCalibration?.();
      observer?.disconnect();
      if (registeredCtrl) {
        unregisterDocRestController(containerId, registeredCtrl);
      }
      if (host) host.innerHTML = '';
    };
  }, [url, containerId, onChunksUpdated]);

  // Server-rendered reservation for the not-yet-loaded rest, in CSS so it is right on the first paint
  // (the coefficient variables have per-breakpoint fallbacks) and follows the client's calibration.
  const f = estimateFeatures.split(',').map(Number);
  const reserve =
    f.length === 4 && f.every(Number.isFinite) && f.some((v) => v > 0)
      ? `calc((${f[0]} * var(--kr) + ${f[1]} * var(--kc) + ${f[2]} * var(--kp) + ${f[3]} * var(--kx)) * 1px + ${Math.round(estimateExtraPx)}px)`
      : undefined;

  return <div ref={hostRef} className="doc-rest doc-list" aria-live="off" style={reserve ? { minHeight: reserve } : undefined} />;
}
