'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';
import { useSearchContext } from './SearchContext';
import { SearchAutocomplete } from './SearchAutocomplete';

export function HomeSearch() {
  const router = useRouter();
  const { searchValue, setSearchValue, triggerSearch } = useSearchContext();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsOpen(false);
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

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-full z-50 box-border">
      <form onSubmit={handleSearch} className="relative w-full max-w-full group box-border">
        <div className="relative flex items-center transition-all duration-300 w-full max-w-full box-border">
          <Search className="absolute left-3.5 sm:left-4 w-4 h-4 text-slate-400 group-focus-within:text-[#00bc8c] transition-colors pointer-events-none" />
          <input
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
            placeholder={isMobile ? 'Search meta...' : 'Search commands, tags, events, mechanisms...'}
            className="w-full max-w-full box-border pl-10 sm:pl-11 pr-24 sm:pr-28 py-2.5 sm:py-3 rounded-xl bg-white dark:bg-[#282b32] hover:dark:bg-[#2e323a] focus:dark:bg-[#2e323a] border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#00bc8c]/40 focus:border-[#00bc8c] focus:shadow-[0_0_20px_rgba(0,188,140,0.18)] transition-all duration-300 shadow-inner"
          />

          <button
            type="submit"
            className="home-search-btn absolute right-1.5 sm:right-2 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all duration-200 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-sm group/btn flex-shrink-0"
          >
            <span>Search</span>
            <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </form>

      <SearchAutocomplete
        query={searchValue}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
      />
    </div>
  );
}
