'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, ArrowRight, X, Clock, Trash2 } from 'lucide-react';
import { useSearchContext } from './SearchContext';
import { SearchAutocomplete, preloadSuggestions } from './SearchAutocomplete';

const RECENT_KEY = 'denizen_recent_searches';
const MAX_RECENT = 6;

export function HomeSearch() {
  const { searchValue, setSearchValue, triggerSearch } = useSearchContext();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (item): item is string => typeof item === 'string' && item.trim().length >= 2
          );
          setRecentSearches(filtered.slice(0, MAX_RECENT));
          if (filtered.length !== parsed.length) {
            localStorage.setItem(RECENT_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
          }
        }
      }
    } catch {}
  }, []);

  const addRecentSearch = useCallback((term: string) => {
    const clean = term.trim();
    if (!clean || clean.length < 2) return;
    setRecentSearches((prev) => {
      const next = [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {}
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  // Global hotkey Ctrl+K / Cmd+K or / on the Home page
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (
        e.key === '/' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
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
    const query = searchValue.trim();
    if (query && query.length >= 2) {
      addRecentSearch(query);
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
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="w-full max-w-full relative z-50">
      <div className="relative w-full">
        <form onSubmit={handleSearch} className="w-full">
          <div className="search-shell group relative flex items-center w-full rounded-2xl bg-[var(--card-bg)] border border-[var(--table-border)] shadow-[var(--card-shadow)]">
            <div className="pl-4 sm:pl-4.5 flex items-center justify-center pointer-events-none text-[var(--text-muted)] group-focus-within:text-[var(--accent-primary)]">
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
                preloadSuggestions();
                if (searchValue.trim()) setIsOpen(true);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search commands, tags, mechanisms, events..."
              className="flex-1 min-w-0 pl-3 pr-2 py-3.5 sm:py-4 rounded-2xl bg-transparent text-[var(--text-page)] placeholder-[var(--text-muted)] text-base focus:outline-none"
            />

            <div className="flex items-center gap-1 pr-2 sm:pr-2.5 flex-shrink-0">
              {searchValue && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchValue('');
                    setIsOpen(false);
                    inputRef.current?.focus();
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-page)] transition-colors cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              <button
                type="submit"
                className="btn-accent h-9 sm:h-9.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold shadow-sm inline-flex items-center justify-center gap-1.5 transition-all duration-150 active:scale-95 cursor-pointer leading-none"
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
          onSelect={(item) => {
            const term = item?.cleanName || item?.name || searchValue.trim();
            if (term && term.length >= 2) {
              addRecentSearch(term);
            }
          }}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
        />
      </div>

      {recentSearches.length > 0 && (
        <div className="mt-3 flex items-center justify-center flex-wrap gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-muted)] mr-0.5 leading-none">
            <Clock className="w-3 h-3 opacity-70 flex-shrink-0 translate-y-px" />
            <span className="leading-none">Recent:</span>
          </span>
          {recentSearches.map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => {
                setSearchValue(term);
                setIsOpen(false);
                triggerSearch(term);
              }}
              className="inline-flex items-center justify-center px-2.5 py-1.5 sm:py-1 rounded-md font-mono text-xs leading-none bg-[var(--card-bg)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-primary)] hover:border-[var(--accent-border)] border border-[var(--table-border)] text-[var(--text-page)] transition-all cursor-pointer shadow-2xs hover:shadow-xs"
            >
              <span className="leading-none">{term}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={clearRecentSearches}
            className="w-6 h-6 inline-flex items-center justify-center rounded text-[var(--text-muted)] hover:text-rose-500 transition-colors ml-0.5 cursor-pointer"
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
