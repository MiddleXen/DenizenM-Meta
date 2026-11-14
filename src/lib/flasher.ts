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

/** Offset so the table header is cleanly below the sticky top navbar. */
const NAVBAR_OFFSET = 70;
let scrollToken = 0;

function targetTop(target: HTMLElement): number {
  return Math.max(0, target.getBoundingClientRect().top + (window.scrollY || window.pageYOffset || 0) - NAVBAR_OFFSET);
}

/**
 * Doc cards use `content-visibility: auto`, so cards that were never on screen are laid out with an
 * estimated height. While smooth-scrolling past them they get their real height and the target moves,
 * so once the scroll settles we re-measure and correct (a few times at most).
 */
function scrollToTarget(target: HTMLElement): void {
  const token = ++scrollToken;
  window.scrollTo({ top: targetTop(target), behavior: 'smooth' });

  // If the user takes over scrolling, never yank the page back.
  const cancel = () => {
    if (token === scrollToken) scrollToken++;
  };
  const userEvents = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
  userEvents.forEach((type) => window.addEventListener(type, cancel, { once: true, passive: true }));
  const cleanup = () => userEvents.forEach((type) => window.removeEventListener(type, cancel));

  let corrections = 0;
  const settle = () => {
    if (token !== scrollToken || !target.isConnected) return cleanup();
    const desired = targetTop(target);
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (Math.abs(window.scrollY - Math.min(desired, maxScroll)) <= 2 || corrections >= 3) return cleanup();
    corrections++;
    window.scrollTo({ top: desired, behavior: 'instant' as ScrollBehavior });
    requestAnimationFrame(() => requestAnimationFrame(settle));
  };

  if ('onscrollend' in window) {
    const onEnd = () => {
      window.removeEventListener('scrollend', onEnd);
      clearTimeout(fallback);
      settle();
    };
    // Fallback if no scroll happens at all (already at target) or scrollend never fires.
    const fallback = setTimeout(onEnd, 1500);
    window.addEventListener('scrollend', onEnd);
  } else {
    setTimeout(settle, 800);
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
