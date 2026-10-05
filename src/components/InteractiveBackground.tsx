'use client';

import React, { useEffect, useRef } from 'react';

export function InteractiveBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let lastX = -999;
    let lastY = -999;
    let rafId: number | null = null;

    const updatePosition = () => {
      rafId = null;
      if (el) {
        el.style.setProperty('--mouse-x', `${lastX}px`);
        el.style.setProperty('--mouse-y', `${lastY}px`);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (rafId === null) {
        rafId = requestAnimationFrame(updatePosition);
      }
    };

    const handleMouseLeave = () => {
      lastX = -999;
      lastY = -999;
      if (rafId === null) {
        rafId = requestAnimationFrame(updatePosition);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="interactive-grid-container fixed inset-0 pointer-events-none -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* 1. Atmospheric soft radial glow */}
      <div className="grid-ambient-glow absolute inset-0" />

      {/* 2. Base subtle grid with soft radial vignette mask */}
      <div className="grid-base-pattern absolute inset-0" />

      {/* 3. Interactive cursor lighting that illuminates grid lines */}
      <div className="grid-cursor-lighting absolute inset-0" />

      {/* 4. Bottom fade into page background */}
      <div className="grid-bottom-fade absolute bottom-0 left-0 right-0 h-40" />
    </div>
  );
}
