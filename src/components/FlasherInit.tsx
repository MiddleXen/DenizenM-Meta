'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { autoflash, clearPendingFlash, doFlashFor, initFlasher } from '@/lib/flasher';

function ensurePreCopyButton(pre: HTMLElement) {
  if (pre.dataset.copyReady === '1') return;
  pre.dataset.copyReady = '1';
  pre.classList.add('doc-pre-block');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pre-copy-btn';
  btn.dataset.copyPre = '1';
  btn.title = 'Copy script snippet';
  btn.setAttribute('aria-label', 'Copy script snippet');
  btn.textContent = 'Copy';
  pre.appendChild(btn);
}

function ensureCardHeaderActions(row: HTMLElement) {
  if (row.dataset.actionsReady === '1') return;
  row.dataset.actionsReady = '1';

  const anchor = row.querySelector('a.doc-anchor-link, a[id]') as HTMLAnchorElement | null;
  if (!anchor) return;
  const cell = anchor.closest('td');
  if (!cell) return;

  const anchorId = anchor.id || anchor.getAttribute('href')?.replace(/^#/, '') || '';
  const copyText = anchor.dataset.copyText || anchor.textContent?.trim() || '';

  const wrap = document.createElement('span');
  wrap.className = 'doc-card-actions';

  if (copyText) {
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'doc-action-btn';
    copyBtn.dataset.copyEntry = copyText;
    copyBtn.title = `Copy "${copyText}"`;
    copyBtn.textContent = 'Copy';
    wrap.appendChild(copyBtn);
  }

  if (anchorId) {
    const linkBtn = document.createElement('button');
    linkBtn.type = 'button';
    linkBtn.className = 'doc-action-btn';
    linkBtn.dataset.copyLink = anchorId;
    linkBtn.title = 'Copy direct link to this entry';
    linkBtn.textContent = '# Link';
    wrap.appendChild(linkBtn);
  }

  if (wrap.childElementCount > 0) {
    cell.classList.add('doc-title-cell');
    cell.appendChild(wrap);
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
    const flashButtonState = (btn: HTMLButtonElement, doneText = '✓ Copied') => {
      const prev = btn.dataset.origLabel || btn.textContent || 'Copy';
      btn.dataset.origLabel = prev;
      btn.textContent = doneText;
      btn.classList.add('is-copied');
      setTimeout(() => {
        btn.textContent = prev;
        btn.classList.remove('is-copied');
      }, 1500);
    };

    const handlePointerOrFocus = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const pre = target.closest('.doc-list pre') as HTMLElement | null;
      if (pre) {
        ensurePreCopyButton(pre);
      }

      const primaryRow = target.closest('.doc-card tr.table-primary') as HTMLElement | null;
      if (primaryRow) {
        ensureCardHeaderActions(primaryRow);
      }
    };

    const handleClick = async (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // 1. Toggle related matches when an exactMatch collapsed other search results
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

      // 2. Copy code block (<pre><code>)
      const preBtn = target.closest('button[data-copy-pre]') as HTMLButtonElement | null;
      if (preBtn) {
        e.preventDefault();
        const pre = preBtn.closest('pre');
        const codeText = pre?.querySelector('code')?.textContent || '';
        if (codeText) {
          try {
            await navigator.clipboard.writeText(codeText);
            flashButtonState(preBtn);
            showToast('Code copied to clipboard');
          } catch {
            showToast('Failed to copy');
          }
        }
        return;
      }

      // 3. Copy entry name / tag syntax
      const entryBtn = target.closest('button[data-copy-entry]') as HTMLButtonElement | null;
      if (entryBtn) {
        e.preventDefault();
        const text = entryBtn.dataset.copyEntry || '';
        if (text) {
          try {
            await navigator.clipboard.writeText(text);
            flashButtonState(entryBtn);
            showToast(`Copied: ${text}`);
          } catch {
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
          try {
            await navigator.clipboard.writeText(url);
            if (window.history?.pushState) {
              window.history.pushState(null, '', `#${encoded}`);
            }
            flashButtonState(linkBtn, '✓ Linked');
            showToast('Direct link copied!');
          } catch {
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
            window.dispatchEvent(new CustomEvent('agy:nav-start'));
            router.push(url.pathname + url.search + url.hash);
          }
        } catch {
          // ignore malformed href
        }
      }
    };

    document.addEventListener('pointerover', handlePointerOrFocus, { passive: true });
    document.addEventListener('focusin', handlePointerOrFocus, { passive: true });
    document.addEventListener('touchstart', handlePointerOrFocus, { passive: true });
    document.addEventListener('click', handleClick);

    return () => {
      document.removeEventListener('pointerover', handlePointerOrFocus);
      document.removeEventListener('focusin', handlePointerOrFocus);
      document.removeEventListener('touchstart', handlePointerOrFocus);
      document.removeEventListener('click', handleClick);
    };
  }, [router]);

  if (!toastMsg) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[120] inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/95 dark:bg-zinc-900/95 text-white text-xs font-medium border border-white/10 shadow-xl pointer-events-none animate-fade-in"
    >
      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
      <span className="truncate max-w-[280px] sm:max-w-md">{toastMsg}</span>
    </div>
  );
}
