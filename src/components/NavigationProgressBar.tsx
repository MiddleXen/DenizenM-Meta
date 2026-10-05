'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function NavigationProgressBar() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [complete, setComplete] = useState(false);
  const isFirstRender = useRef(true);

  // When pathname changes (navigation completed)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Complete the bar cleanly
    setComplete(true);
    const timer = setTimeout(() => {
      setActive(false);
      setComplete(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [pathname]);

  // Start progress on internal link clicks and popstate
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor || !anchor.href) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      try {
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin === window.location.origin) {
          if (
            url.pathname !== window.location.pathname ||
            (url.search && url.search !== window.location.search)
          ) {
            setComplete(false);
            setActive(true);
          }
        }
      } catch {
        // ignore invalid urls
      }
    };

    const handlePopState = () => {
      setComplete(false);
      setActive(true);
    };

    window.addEventListener('click', handleAnchorClick, true);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('click', handleAnchorClick, true);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[2.5px] z-[99999] pointer-events-none transition-opacity duration-200"
      style={{ opacity: complete ? 0 : 1 }}
      aria-hidden="true"
    >
      <div
        className="h-full bg-gradient-to-r from-emerald-500 via-[#00bc8c] to-teal-300 dark:from-[#00bc8c] dark:via-emerald-400 dark:to-teal-200 shadow-[0_0_10px_rgba(0,188,140,0.8),0_0_3px_rgba(0,188,140,0.6)]"
        style={{
          width: complete ? '100%' : '75%',
          transition: complete
            ? 'width 0.15s ease-out'
            : 'width 2.5s cubic-bezier(0.08, 0.6, 0.08, 1)',
        }}
      />
    </div>
  );
}
