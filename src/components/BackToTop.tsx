'use client';

import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!visible) return null;

  return (
    <button
      onClick={scrollToTop}
      aria-label="Back to top"
      className="fixed bottom-6 right-6 z-40 p-2.5 rounded-lg bg-white/95 dark:bg-[#151921]/95 backdrop-blur-xs text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-sm transition-colors cursor-pointer"
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}
