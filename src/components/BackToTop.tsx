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
      className="fixed bottom-6 right-6 z-40 p-3 rounded-xl bg-slate-900/90 dark:bg-[#282b32]/90 backdrop-blur-md text-slate-200 dark:text-emerald-400 border border-slate-700/60 dark:border-white/15 hover:border-emerald-500/60 shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-1 active:scale-95 transition-all duration-300 cursor-pointer animate-fade-in group"
    >
      <ArrowUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform duration-200" />
    </button>
  );
}
