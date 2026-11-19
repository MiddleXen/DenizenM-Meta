'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { smoothScrollToTop } from '@/lib/flasher';

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    let lastVisible = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const nowVisible = window.scrollY > 400;
          if (nowVisible !== lastVisible) {
            lastVisible = nowVisible;
            setVisible(nowVisible);
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    smoothScrollToTop();
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className="fixed fab-bottom right-4 sm:right-6 z-40 w-10.5 h-10.5 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-lg bg-[var(--card-bg)]/95 text-[var(--text-page)] border border-[var(--table-border)] hover:border-[var(--accent-border)] hover:text-[var(--accent-primary)] shadow-sm transition-colors cursor-pointer"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}
