'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useSearchContext } from './SearchContext';
import { SearchAutocomplete } from './SearchAutocomplete';

interface DocSearchBarProps {
  basePath: string;
  placeholder: string;
  initialValue?: string | null;
}

const getCategoryFromPath = (path: string): string | undefined => {
  if (path.includes('/Docs/Commands')) return 'Command';
  if (path.includes('/Docs/Tags')) return 'Tag';
  if (path.includes('/Docs/Events')) return 'Event';
  if (path.includes('/Docs/Mechanisms')) return 'Mechanism';
  if (path.includes('/Docs/ObjectTypes')) return 'ObjectType';
  if (path.includes('/Docs/Languages')) return 'Language';
  if (path.includes('/Docs/Actions')) return 'Action';
  return undefined;
};

export function DocSearchBar({ basePath, placeholder, initialValue }: DocSearchBarProps) {
  const router = useRouter();
  const { searchValue, setSearchValue } = useSearchContext();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const categoryFilter = getCategoryFromPath(basePath);

  useEffect(() => {
    if (initialValue) {
      setSearchValue(initialValue);
    }
  }, [initialValue, setSearchValue]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
    } else if (e.key === 'Enter') {
      setIsOpen(false);
      const trimmed = searchValue.trim();
      if (trimmed) {
        router.push(`${basePath}/${encodeURIComponent(trimmed)}`);
      } else {
        setSearchValue('');
        router.push(basePath);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative z-50 w-full max-w-xl mx-auto text-left px-3 sm:px-0">
      <div className="relative flex items-center w-full rounded-xl bg-white dark:bg-[#12161f] border border-slate-200 dark:border-white/10 shadow-md dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] transition-all duration-200 focus-within:border-emerald-500/60 focus-within:ring-4 focus-within:ring-emerald-500/10">
        <Search className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          id="search_bar"
          placeholder={placeholder}
          value={searchValue}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => {
            setSearchValue(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => {
            if (searchValue.trim()) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          style={{ paddingLeft: '2.85rem', paddingRight: '2.5rem' }}
          className="w-full py-2.5 sm:py-3 rounded-xl bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none"
        />
        {searchValue && (
          <button
            type="button"
            onClick={() => {
              setSearchValue('');
              setIsOpen(false);
              router.push(basePath);
              inputRef.current?.focus();
            }}
            className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            aria-label="Clear filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <SearchAutocomplete
        query={searchValue}
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
