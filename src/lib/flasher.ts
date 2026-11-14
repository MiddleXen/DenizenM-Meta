/**
 * Flasher and smooth scroll utility for Denizen Meta documentation
 * Converted to native TypeScript module
 */

declare global {
  interface Window {
    doFlashFor?: (elementId: string, e?: Event | React.MouseEvent | MouseEvent) => void;
    autoflash?: () => void;
  }
}

/** Offset so the table header is cleanly below the sticky top navbar. */
const NAVBAR_OFFSET = 70;
let scrollToken = 0;

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

/** If the user starts scrolling manually during a programmatic glide, stop immediately. */
function attachUserAbort(token: number, startedAt: number): () => void {
  const cancel = () => {
    if (performance.now() - startedAt < 24) return;
    if (token === scrollToken) scrollToken++;
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
  const anchorBox = target.closest('.doc-card') || target.closest('.category_title') || target;
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

/**
 * Smoothly scrolls back to `top: 0` without showing blank background on huge pages (Tags is ~900k px).
 * Native `behavior: 'smooth'` across 100k+ px moves faster than GPU tile rasterization and
 * `content-visibility` unlocking, producing empty frames. Instead we step into the already-rendered
 * top region and glide the final ~2.4 viewports via `requestAnimationFrame`.
 */
export function smoothScrollToTop(): void {
  if (typeof window === 'undefined') return;
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

export function doFlashFor(elementId: string, e?: Event | React.MouseEvent | MouseEvent): void {
  if (e && 'preventDefault' in e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  } else if (typeof window !== 'undefined' && (window as unknown as { event?: { preventDefault?: () => void } }).event?.preventDefault) {
    (window as unknown as { event?: { preventDefault?: () => void } }).event?.preventDefault?.();
  }

  if (!elementId || typeof document === 'undefined') return;
  const flashable = document.getElementById(elementId);
  if (!flashable) return;

  // Find nearest table card or element itself
  const target = flashable.closest('table') || flashable;

  target.classList.remove('flash');
  // Trigger DOM reflow to restart CSS animation
  void (target as HTMLElement).offsetWidth;
  target.classList.add('flash');

  scrollToTarget(target as HTMLElement);

  // Update hash in URL without triggering native browser jump
  if (window.history && window.history.pushState) {
    window.history.pushState(null, '', '#' + elementId);
  }
}

export function autoflash(): void {
  if (typeof window === 'undefined') return;
  const hash = window.location.hash;
  if (!hash || hash.length < 2) return;
  const targetId = decodeURIComponent(hash.substring(1));
  setTimeout(() => {
    doFlashFor(targetId);
  }, 100);
}

export function initFlasher(): () => void {
  if (typeof window === 'undefined') return () => {};

  window.doFlashFor = doFlashFor;
  window.autoflash = autoflash;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoflash);
  } else {
    autoflash();
  }

  window.addEventListener('hashchange', autoflash);

  return () => {
    window.removeEventListener('hashchange', autoflash);
  };
}
