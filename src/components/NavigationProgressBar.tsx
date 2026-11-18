'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

export function NavigationProgressBar() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [complete, setComplete] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setComplete(true);
    const timer = setTimeout(() => {
      setActive(false);
      setComplete(false);
    }, 350);

    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const startBar = () => {
      setComplete(false);
      setActive(true);
    };

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
            startBar();
          }
        }
      } catch {
        // ignore invalid urls
      }
    };

    window.addEventListener('click', handleAnchorClick, true);
    window.addEventListener('popstate', startBar);
    window.addEventListener('agy:nav-start', startBar);

    return () => {
      window.removeEventListener('click', handleAnchorClick, true);
      window.removeEventListener('popstate', startBar);
      window.removeEventListener('agy:nav-start', startBar);
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
        className="h-full"
        style={{
          backgroundColor: 'var(--accent-primary)',
          width: complete ? '100%' : '75%',
          transition: complete
            ? 'width 0.15s ease-out'
            : 'width 2.5s cubic-bezier(0.08, 0.6, 0.08, 1)',
        }}
      />
    </div>
  );
}
