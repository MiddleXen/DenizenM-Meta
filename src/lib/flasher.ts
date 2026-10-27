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

  // Offset by 70px so the table header is cleanly below the sticky top navbar
  const rect = target.getBoundingClientRect();
  const targetY = Math.max(0, rect.top + (window.pageYOffset || window.scrollY || 0) - 70);

  window.scrollTo({
    top: targetY,
    behavior: 'smooth',
  });

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
