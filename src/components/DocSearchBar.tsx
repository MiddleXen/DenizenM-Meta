'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { SearchAutocomplete, preloadSuggestions } from './SearchAutocomplete';

interface DocSearchBarProps {
  basePath: string;
  placeholder: string;
  initialValue?: string | null;
}

const getCategoryFromPath = (path: string): string | undefined => {
  const low = path.toLowerCase();
  if (low.includes('/docs/commands')) return 'Command';
  if (low.includes('/docs/tags')) return 'Tag';
  if (low.includes('/docs/events')) return 'Event';
  if (low.includes('/docs/mechanisms')) return 'Mechanism';
  if (low.includes('/docs/objecttypes')) return 'ObjectType';
  if (low.includes('/docs/languages')) return 'Language';
  if (low.includes('/docs/actions')) return 'Action';
  return undefined;
};

export function DocSearchBar({ basePath, placeholder, initialValue }: DocSearchBarProps) {
  const router = useRouter();
  const [filterValue, setFilterValue] = useState(initialValue || '');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const categoryFilter = getCategoryFromPath(basePath);

  useEffect(() => {
    setFilterValue(initialValue || '');
  }, [initialValue]);

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  // Press `/` anywhere on a Doc page to jump straight to the section search bar
  useEffect(() => {
    const onGlobalKey = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (document.activeElement as HTMLElement | null)?.isContentEditable) {
        return;
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onGlobalKey);
    return () => window.removeEventListener('keydown', onGlobalKey);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => prev + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    } else if (e.key === 'Enter') {
      setIsOpen(false);
      const trimmed = filterValue.trim();
      const target = trimmed ? `${basePath}/${encodeURIComponent(trimmed)}` : basePath;
      if (typeof window !== 'undefined' && window.location.pathname !== target) {
        window.dispatchEvent(new CustomEvent('agy:nav-start'));
      }
      if (!trimmed) {
        setFilterValue('');
      }
      router.push(target);
    }
  };

  return (
    <div ref={containerRef} className="relative z-50 w-full max-w-xl mx-auto text-left">
      <div className="relative flex items-center w-full rounded-xl bg-white dark:bg-[#12161f] border border-slate-200 dark:border-white/10 shadow-sm transition-colors duration-150 focus-within:border-[var(--accent-primary)]">
        <Search className="ml-3.5 w-4 h-4 text-slate-400 pointer-events-none flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          id="search_bar"
          placeholder={placeholder}
          value={filterValue}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => {
            setFilterValue(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            preloadSuggestions();
            if (filterValue.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 px-2.5 py-2.5 sm:py-3 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-base sm:text-sm focus:outline-none"
        />
        {filterValue && (
          <button
            type="button"
            onClick={() => {
              setFilterValue('');
              setIsOpen(false);
              if (initialValue) {
                if (typeof window !== 'undefined' && window.location.pathname !== basePath) {
                  window.dispatchEvent(new CustomEvent('agy:nav-start'));
                }
                router.push(basePath);
              }
              inputRef.current?.focus();
            }}
            className="mr-2 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer flex-shrink-0"
            aria-label="Clear filter"
          >
            <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </button>
        )}
      </div>

      <SearchAutocomplete
        query={filterValue}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        categoryFilter={categoryFilter}
        basePath={basePath}
      />
    </div>
  );
}
