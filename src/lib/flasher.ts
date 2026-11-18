/**
 * Flasher and smooth scroll utility for Denizen Meta documentation
 */

import { ensureAnyRestAnchorMounted } from './doc-rest-registry';

declare global {
  interface Window {
    doFlashFor?: (elementId: string, e?: Event | React.MouseEvent | MouseEvent) => void;
    autoflash?: () => void;
  }
}

/** Offset so the table header is cleanly below the sticky top navbar. */
const NAVBAR_OFFSET = 72;
let scrollToken = 0;
let pendingFlashId: string | null = null;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function clampScrollY(y: number): number {
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  return Math.min(Math.max(0, y), maxScroll);
}

function targetTop(target: HTMLElement): number {
  return Math.max(0, target.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0) - NAVBAR_OFFSET);
}

function safeDecode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function resolveAnchorElement(rawId: string): HTMLElement | null {
  if (!rawId || typeof document === 'undefined') return null;
  const decoded = safeDecode(rawId);
  const encoded = encodeURIComponent(decoded);

  const findInDom = (): HTMLElement | null =>
    document.getElementById(rawId) ||
    document.getElementById(decoded) ||
    document.getElementById(encoded) ||
    document.getElementById(`category-${decoded}`) ||
    document.getElementById(`category-${encoded}`);

  const found = findInDom();
  if (found) return found;

  if (
    ensureAnyRestAnchorMounted(
      rawId,
      decoded,
      encoded,
      `category-${decoded}`,
      `category-${encoded}`
    )
  ) {
    return findInDom();
  }
  return null;
}

/** If the user starts scrolling manually during a programmatic glide, stop immediately. */
function attachUserAbort(token: number, startedAt: number): () => void {
  const cancel = () => {
    if (performance.now() - startedAt < 24) return;
    if (token === scrollToken) {
      scrollToken++;
      pendingFlashId = null;
    }
  };
  const userEvents = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
  userEvents.forEach((type) => window.addEventListener(type, cancel, { once: true, passive: true }));
  return () => userEvents.forEach((type) => window.removeEventListener(type, cancel));
}

/**
 * Temporarily disables `content-visibility: auto` on cards right around `target` so jumping near
 * `target` from hundreds of thousands of pixels away renders real cards on the very first frame.
 */
function unlockNearbyCards(target: HTMLElement): () => void {
  const unlocked: HTMLElement[] = [];
  const unlock = (el: Element | null) => {
    if (el instanceof HTMLElement && el.classList.contains('doc-card') && !el.style.contentVisibility) {
      el.style.contentVisibility = 'visible';
      unlocked.push(el);
    }
  };
  const anchorBox = target.closest('.doc-card') || target.closest('.category_header_block') || target.closest('.category_title') || target;
  unlock(anchorBox);
  let prev = anchorBox.previousElementSibling;
  for (let i = 0; i < 10 && prev; i++, prev = prev.previousElementSibling) unlock(prev);
  let next = anchorBox.nextElementSibling;
  for (let i = 0; i < 10 && next; i++, next = next.nextElementSibling) unlock(next);

  return () => {
    requestAnimationFrame(() => {
      for (const el of unlocked) el.style.contentVisibility = '';
    });
  };
}

export function smoothScrollToTop(): void {
  if (typeof window === 'undefined') return;
  pendingFlashId = null;
  const token = ++scrollToken;
  let startY = window.scrollY || window.pageYOffset || 0;
  if (startY <= 0) return;

  if (prefersReducedMotion()) {
    window.scrollTo(0, 0);
    return;
  }

  const maxGlide = Math.max(1200, Math.round(window.innerHeight * 2.4));
  if (startY > maxGlide) {
    window.scrollTo({ top: maxGlide, behavior: 'instant' as ScrollBehavior });
    startY = maxGlide;
  }

  const startedAt = performance.now();
  const duration = Math.min(420, Math.max(220, startY * 0.18));
  const cleanup = attachUserAbort(token, startedAt);

  const step = (now: number) => {
    if (token !== scrollToken) {
      cleanup();
      return;
    }
    const p = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    window.scrollTo(0, Math.round(startY * (1 - eased)));
    if (p < 1) {
      requestAnimationFrame(step);
    } else {
      cleanup();
    }
  };

  requestAnimationFrame(step);
}

function scrollToTarget(target: HTMLElement): void {
  const token = ++scrollToken;
  const restoreCards = unlockNearbyCards(target);
  const desired = clampScrollY(targetTop(target));
  let startY = window.scrollY || window.pageYOffset || 0;

  if (Math.abs(desired - startY) <= 2) {
    restoreCards();
    return;
  }

  if (prefersReducedMotion()) {
    window.scrollTo(0, desired);
    restoreCards();
    return;
  }

  const maxGlide = Math.max(1200, Math.round(window.innerHeight * 2.2));
  if (Math.abs(desired - startY) > maxGlide) {
    const direction = desired > startY ? 1 : -1;
    const approachY = clampScrollY(desired - direction * maxGlide);
    window.scrollTo({ top: approachY, behavior: 'instant' as ScrollBehavior });
    startY = window.scrollY || window.pageYOffset || approachY;
  }

  const startedAt = performance.now();
  const distance = Math.abs(clampScrollY(targetTop(target)) - startY);
  const duration = Math.min(420, Math.max(220, distance * 0.18));
  const cleanup = attachUserAbort(token, startedAt);

  const finish = () => {
    cleanup();
    restoreCards();
  };

  const step = (now: number) => {
    if (token !== scrollToken || !target.isConnected) {
      finish();
      return;
    }
    const p = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    const liveDesired = clampScrollY(targetTop(target));
    window.scrollTo(0, Math.round(startY + (liveDesired - startY) * eased));
    if (p < 1) {
      requestAnimationFrame(step);
    } else {
      finish();
    }
  };

  requestAnimationFrame(step);
}

function flashAndScrollElement(flashable: HTMLElement, allowReset = true): void {
  // Unhide if target happens to be inside a collapsed related-matches section
  const hiddenParent = flashable.closest('.related-matches-body[hidden]') as HTMLElement | null;
  if (hiddenParent) {
    hiddenParent.hidden = false;
  }

  // If an active DocFilterBar filter currently hides this card/category, auto-reset the filter before scrolling.
  if (allowReset) {
    const cardOrCat = (flashable.closest('.doc-card') || flashable.closest('.category_header_block')) as HTMLElement | null;
    if (cardOrCat && (getComputedStyle(cardOrCat).display === 'none' || cardOrCat.getClientRects().length === 0)) {
      window.dispatchEvent(new CustomEvent('agy:reset-doc-filters'));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          flashAndScrollElement(flashable, false);
        });
      });
      return;
    }
  }

  const target = (flashable.closest('table') || flashable.closest('.category_title') || flashable) as HTMLElement;
  target.classList.remove('flash');
  void target.offsetWidth;
  target.classList.add('flash');

  scrollToTarget(target);
}

export function doFlashFor(
  elementId: string,
  e?: Event | React.MouseEvent | MouseEvent,
  updateHash = true
): void {
  if (e && 'preventDefault' in e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  if (!elementId || typeof document === 'undefined') return;
  const decoded = safeDecode(elementId);

  // Always update URL hash immediately so even deferred DocRestLoader chunks know where to jump.
  if (updateHash && window.history && window.history.pushState) {
    const cleanHash = '#' + encodeURIComponent(decoded);
    if (window.location.hash !== cleanHash) {
      window.history.pushState(null, '', cleanHash);
    }
  }

  const flashable = resolveAnchorElement(decoded);
  if (!flashable) {
    // Target may still be streaming in via DocRestLoader; queue it for immediate resolution.
    pendingFlashId = decoded;
    return;
  }

  pendingFlashId = null;
  flashAndScrollElement(flashable);
}

/**
 * Called by DocRestLoader as chunks arrive so clicking a category chip or opening a deep `#hash`
 * jumps as soon as that card/category enters the DOM instead of failing silently.
 */
export function tryFlushPendingFlash(): boolean {
  if (typeof window === 'undefined') return false;
  const candidate =
    pendingFlashId ||
    (window.location.hash.length > 1 ? safeDecode(window.location.hash.slice(1)) : null);
  if (!candidate) return false;

  const el = resolveAnchorElement(candidate);
  if (!el) return false;

  pendingFlashId = null;
  flashAndScrollElement(el);
  return true;
}

export function clearPendingFlash(): void {
  pendingFlashId = null;
}

export function autoflash(): void {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return;
  const targetId = safeDecode(hash.substring(1));
  setTimeout(() => {
    doFlashFor(targetId, undefined, false);
  }, 60);
}

export function initFlasher(): () => void {
  if (typeof window === 'undefined') return () => {};

  window.doFlashFor = doFlashFor;
  window.autoflash = autoflash;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoflash, { once: true });
  } else {
    autoflash();
  }

  window.addEventListener('hashchange', autoflash);

  return () => {
    window.removeEventListener('hashchange', autoflash);
  };
}
