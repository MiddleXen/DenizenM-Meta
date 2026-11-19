'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { autoflash, clearPendingFlash, doFlashFor, initFlasher } from '@/lib/flasher';

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }

  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);

  try {
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

export function FlasherInit() {
  const router = useRouter();
  const pathname = usePathname();
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), 1800);
  };

  useEffect(() => {
    const cleanup = initFlasher();
    return () => {
      cleanup();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Re-run hash autoflash on SPA route transitions (e.g. clicking ObjectTypes -> /Docs/Tags#playertag)
  useEffect(() => {
    clearPendingFlash();
    if (typeof window !== 'undefined' && window.location.hash.length > 1) {
      autoflash();
    }
  }, [pathname]);

  useEffect(() => {
    const btnTimers = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>();

    const flashButtonState = (btn: HTMLButtonElement, doneText = 'Copied') => {
      const prevTimer = btnTimers.get(btn);
      if (prevTimer) clearTimeout(prevTimer);

      const prev = btn.dataset.origLabel || btn.textContent || 'Copy';
      btn.dataset.origLabel = prev;
      btn.textContent = doneText;
      btn.classList.add('is-copied');

      const timer = setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove('is-copied');
        btnTimers.delete(btn);
      }, 1500);
      btnTimers.set(btn, timer);
    };

    const handleClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. Toggle collapsible mobile categories box
      const catToggleBtn = target.closest('button[data-categories-toggle]') as HTMLButtonElement | null;
      if (catToggleBtn) {
        e.preventDefault();
        const wrapper = catToggleBtn.closest('.categories_wrapper');
        if (wrapper) {
          const expanded = wrapper.classList.toggle('is-expanded');
          catToggleBtn.setAttribute('aria-expanded', String(expanded));
          const count = wrapper.querySelector('.categories_badge')?.textContent?.trim() || '';
          catToggleBtn.textContent = expanded
            ? 'Show fewer categories'
            : `Show all ${count} categories`;
        }
        return;
      }

      // 2. Toggle related matches when an exactMatch collapsed other search results
      const relatedBtn = target.closest('button[data-related-toggle]') as HTMLButtonElement | null;
      if (relatedBtn) {
        e.preventDefault();
        const wrapper = relatedBtn.closest('.related-matches-wrapper');
        const body = wrapper?.querySelector('.related-matches-body') as HTMLElement | null;
        if (body) {
          const willShow = Boolean(body.hidden);
          body.hidden = !willShow;
          relatedBtn.setAttribute('aria-expanded', String(willShow));
          relatedBtn.classList.toggle('is-open', willShow);
        }
        return;
      }

      // 3. Copy code block (<pre><code>)
      const preBtn = target.closest('button[data-copy-pre]') as HTMLButtonElement | null;
      if (preBtn) {
        e.preventDefault();
        const preContainer = preBtn.closest('.pre-wrap') || preBtn.closest('pre');
        const codeText = preContainer?.querySelector('code')?.textContent || '';
        if (codeText) {
          const ok = await copyToClipboard(codeText);
          if (ok) {
            flashButtonState(preBtn, 'Copied');
            showToast('Code copied to clipboard');
          } else {
            showToast('Failed to copy');
          }
        }
        return;
      }

      // 4. Copy direct #anchor link
      const linkBtn = target.closest('button[data-copy-link]') as HTMLButtonElement | null;
      if (linkBtn) {
        e.preventDefault();
        const anchorId = linkBtn.dataset.copyLink || '';
        if (anchorId) {
          const encoded = encodeURIComponent(anchorId);
          const url = `${window.location.origin}${window.location.pathname}#${encoded}`;
          const ok = await copyToClipboard(url);
          if (ok) {
            if (window.history?.pushState) {
              window.history.pushState(null, '', `#${encoded}`);
            }
            flashButtonState(linkBtn, 'Linked');
            showToast('Direct link copied!');
          } else {
            showToast('Failed to copy link');
          }
        }
        return;
      }

      // 5. Anchor & internal SPA navigation delegation inside documentation HTML
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      const anchor = target.closest('a') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const rawHref = anchor.getAttribute('href');
      if (!rawHref) return;

      // Same-page `#hash` links (category chips, card title anchors, etc.)
      if (rawHref.startsWith('#')) {
        if (rawHref.length > 1) {
          doFlashFor(rawHref.slice(1), e);
        }
        return;
      }

      // Internal `/Docs/...` cross-links inside raw HTML (`dangerouslySetInnerHTML`)
      if (anchor.closest('.doc-list')) {
        try {
          const url = new URL(anchor.href, window.location.origin);
          if (url.origin === window.location.origin) {
            if (url.pathname === window.location.pathname && url.hash.length > 1) {
              doFlashFor(url.hash.slice(1), e);
              return;
            }
            e.preventDefault();
            if (url.pathname !== window.location.pathname || url.search !== window.location.search) {
              window.dispatchEvent(new CustomEvent('agy:nav-start'));
            }
            router.push(url.pathname + url.search + url.hash);
          }
        } catch {
          // ignore malformed href
        }
      }
    };

    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('click', handleClick);
    };
  }, [router]);

  if (!toastMsg) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-18 sm:bottom-6 left-1/2 -translate-x-1/2 z-[120] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/95 dark:bg-zinc-900/95 text-white text-xs font-medium border border-white/10 shadow-xl pointer-events-none animate-fade-in max-w-[calc(100vw-2rem)]"
    >
      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
      <span className="truncate max-w-[260px] sm:max-w-md">{toastMsg}</span>
    </div>
  );
}
