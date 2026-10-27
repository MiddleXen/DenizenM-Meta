'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ArrowRight, X, Clock, Trash2 } from 'lucide-react';
import { useSearchContext } from './SearchContext';
import { SearchAutocomplete } from './SearchAutocomplete';

const RECENT_KEY = 'denizen_recent_searches';
const MAX_RECENT = 6;

export function HomeSearch() {
  const { searchValue, setSearchValue, triggerSearch } = useSearchContext();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, MAX_RECENT));
        }
      }
    } catch (_) {}
  }, []);

  const addRecentSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch (_) {}
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global hotkey Ctrl+K / Cmd+K or / to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpen(false);
    if (searchValue.trim()) {
      addRecentSearch(searchValue.trim());
    }
    triggerSearch();
  };

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
    }
  };

  return (
    <div ref={containerRef} className="w-full max-w-full relative z-50">
      {/* Search Input Container - Autocomplete anchors directly to this */}
      <div className="relative w-full">
        <form onSubmit={handleSearch} className="w-full">
          <div className="relative flex items-center w-full rounded-2xl bg-white dark:bg-[#0c0e14]/90 border border-slate-200/90 dark:border-white/[0.08] shadow-md dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] transition-all duration-200 focus-within:border-emerald-500/50 focus-within:ring-4 focus-within:ring-emerald-500/10">
            <div className="pl-4 sm:pl-4.5 flex items-center justify-center pointer-events-none text-slate-400 group-focus-within:text-emerald-500">
              <Search className="w-5 h-5 transition-colors" />
            </div>

            <input
              ref={inputRef}
              type="text"
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
              placeholder="Search commands, tags, mechanisms, events..."
              className="w-full pl-3.5 pr-28 sm:pr-32 py-3.5 sm:py-4 rounded-2xl bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-sm sm:text-base focus:outline-none"
            />

            <div className="absolute right-2 sm:right-2.5 flex items-center gap-1.5">
              {searchValue && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchValue('');
                    setIsOpen(false);
                    inputRef.current?.focus();
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                type="submit"
                className="h-9 sm:h-9.5 px-3.5 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm inline-flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer leading-none"
              >
                <span className="leading-none select-none -translate-y-[0.5px]">Search</span>
                <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" />
              </button>
            </div>
          </div>
        </form>

        <SearchAutocomplete
          query={searchValue}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSelect={() => {
            if (searchValue.trim()) {
              addRecentSearch(searchValue.trim());
            }
          }}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
        />
      </div>

      {/* Recent Searches (Displayed ONLY when there is history) */}
      {recentSearches.length > 0 && (
        <div className="mt-3 flex items-center justify-center flex-wrap gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 mr-0.5 leading-none">
            <Clock className="w-3 h-3 opacity-70 flex-shrink-0" />
            <span className="leading-none">Recent:</span>
          </span>
          {recentSearches.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => {
                setSearchValue(term);
                setIsOpen(false);
                inputRef.current?.focus();
              }}
              className="inline-flex items-center justify-center px-2.5 py-1 rounded-md font-mono text-xs leading-none bg-white dark:bg-[#0c0e14] hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
            >
              <span className="leading-none">{term}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearRecentSearches}
            className="w-6 h-6 inline-flex items-center justify-center rounded text-slate-400 hover:text-rose-500 transition-colors ml-0.5 cursor-pointer"
            title="Clear search history"
            aria-label="Clear search history"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}
