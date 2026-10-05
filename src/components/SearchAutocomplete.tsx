'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BookOpen, Code, Tag, Zap, Cpu, Sparkles, Terminal } from 'lucide-react';
import { SearchSuggestion, filterSuggestions } from '@/lib/suggestions';

interface SearchAutocompleteProps {
  query: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect?: () => void;
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  categoryFilter?: string;
  className?: string;
}

let memorySuggestions: SearchSuggestion[] | null = null;
let fetchPromise: Promise<SearchSuggestion[]> | null = null;

async function getSuggestionsData(): Promise<SearchSuggestion[]> {
  if (memorySuggestions) return memorySuggestions;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const res = await fetch('/data/search-suggestions.json', { cache: 'force-cache' });
      if (res.ok) {
        const data = await res.json();
        memorySuggestions = data;
        return data;
      }
    } catch (e) {
      console.warn('Failed to load search suggestions json, fallback to API:', e);
    }
    return [];
  })();

  return fetchPromise;
}

export function SearchAutocomplete({
  query,
  isOpen,
  onClose,
  onSelect,
  activeIndex,
  setActiveIndex,
  categoryFilter,
  className = '',
}: SearchAutocompleteProps) {
  const router = useRouter();
  const [allSuggestions, setAllSuggestions] = useState<SearchSuggestion[]>(memorySuggestions || []);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!memorySuggestions) {
      getSuggestionsData().then((data) => {
        if (data && data.length > 0) {
          setAllSuggestions(data);
        }
      });
    }
  }, []);

  const matches = useMemo(() => {
    if (!query || query.trim().length === 0) return [];
    return filterSuggestions(allSuggestions, query, 50, categoryFilter);
  }, [allSuggestions, query, categoryFilter]);

  // Keep itemRefs array size in sync
  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, matches.length);
  }, [matches.length]);

  // Auto-scroll selected active item into view during keyboard navigation
  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [activeIndex]);

  // Handle Enter key when an autocomplete item is actively highlighted
  useEffect(() => {
    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Enter' && activeIndex >= 0 && matches[activeIndex]) {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        if (onSelect) onSelect();
        router.push(matches[activeIndex].href);
      }
    };
    window.addEventListener('keydown', handleKeyDownCapture, true);
    return () => window.removeEventListener('keydown', handleKeyDownCapture, true);
  }, [isOpen, activeIndex, matches, onClose, onSelect, router]);

  if (!isOpen || !query.trim()) {
    return null;
  }

  const getTypeBadge = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'Command':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold leading-none bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <Terminal className="w-2.5 h-2.5" />
            <span>CMD</span>
          </span>
        );
      case 'Tag':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold leading-none bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            <Tag className="w-2.5 h-2.5" />
            <span>TAG</span>
          </span>
        );
      case 'Event':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold leading-none bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Zap className="w-2.5 h-2.5" />
            <span>EVENT</span>
          </span>
        );
      case 'Mechanism':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold leading-none bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
            <Cpu className="w-2.5 h-2.5" />
            <span>MECH</span>
          </span>
        );
      case 'ObjectType':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold leading-none bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
            <Code className="w-2.5 h-2.5" />
            <span>TYPE</span>
          </span>
        );
      case 'Language':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold leading-none bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
            <BookOpen className="w-2.5 h-2.5" />
            <span>LANG</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold leading-none bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">
            <Sparkles className="w-2.5 h-2.5" />
            <span>{type}</span>
          </span>
        );
    }
  };

  const highlightMatch = (text: string, q: string) => {
    const cleanQ = q.trim();
    if (!cleanQ) return text;
    const lower = text.toLowerCase();
    const idx = lower.indexOf(cleanQ.toLowerCase());
    if (idx === -1) return text;

    const before = text.slice(0, idx);
    const matched = text.slice(idx, idx + cleanQ.length);
    const after = text.slice(idx + cleanQ.length);

    return (
      <>
        {before}
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {matched}
        </span>
        {after}
      </>
    );
  };

  const handleItemClick = (href: string) => {
    onClose();
    if (onSelect) onSelect();
    router.push(href);
  };

  return (
    <div
      className={`search-autocomplete-panel absolute left-0 right-0 w-full max-w-full top-full mt-1.5 rounded-xl bg-white dark:bg-[#1a1d24] backdrop-blur-xl border border-slate-200 dark:border-white/15 shadow-2xl overflow-hidden z-[100] text-left box-border ${className}`}
    >
      <div className="px-3.5 py-2 text-[11px] font-semibold text-slate-400 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-200/60 dark:border-white/[0.08] bg-slate-50/80 dark:bg-black/25">
        <div className="flex items-center gap-1.5">
          <span>Suggestions</span>
          {matches.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-[#00bc8c]">
              {matches.length}
            </span>
          )}
        </div>
        <span className="hidden sm:inline-block text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
          ↑↓ navigate &bull; ↵ select
        </span>
      </div>

      <div
        ref={listRef}
        className="max-h-[380px] sm:max-h-[460px] overflow-y-auto overscroll-contain divide-y divide-slate-100 dark:divide-white/[0.06] py-1"
      >
        {matches.length > 0 ? (
          matches.map((item, idx) => {
            const isSelected = activeIndex === idx;
            return (
              <div
                key={item.href}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                onMouseMove={() => setActiveIndex(idx)}
                onClick={() => handleItemClick(item.href)}
                className={`px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors duration-100 ${
                  isSelected
                    ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-950 dark:text-emerald-300'
                    : 'text-slate-800 dark:text-zinc-200 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/10 hover:text-emerald-900 dark:hover:text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {getTypeBadge(item.type)}
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-semibold truncate">
                      {highlightMatch(item.name, query)}
                    </div>
                    {item.description && (
                      <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate mt-0.5">
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>

                <ArrowRight
                  className={`w-3.5 h-3.5 flex-shrink-0 text-slate-400 transition-transform ${
                    isSelected ? 'translate-x-1 text-emerald-500 dark:text-emerald-400' : 'opacity-40'
                  }`}
                />
              </div>
            );
          })
        ) : (
          <div className="px-4 py-5 text-xs text-center text-slate-500 dark:text-zinc-400">
            No direct matches for &ldquo;<strong>{query}</strong>&rdquo;. Press{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 font-mono text-[10px] border border-slate-200 dark:border-white/10">
              Enter
            </kbd>{' '}
            to search full documentation.
          </div>
        )}
      </div>

      {/* Footer link to full search */}
      <div className="p-2 border-t border-slate-200/60 dark:border-white/[0.08] bg-slate-50/80 dark:bg-black/35">
        <Link
          href={`/Docs/Search/${encodeURIComponent(query.trim())}`}
          onClick={() => {
            onClose();
            if (onSelect) onSelect();
          }}
          className="w-full px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-200/50 dark:hover:bg-white/5 flex items-center justify-between gap-2 transition-colors no-underline hover:no-underline min-w-0"
        >
          <span className="flex items-center gap-1.5 truncate min-w-0 flex-1">
            <span className="flex-shrink-0">Search all for</span>
            <span className="font-bold text-slate-900 dark:text-white truncate">
              &ldquo;{query}&rdquo;
            </span>
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-zinc-400 flex-shrink-0">
            ↵ Enter
          </span>
        </Link>
      </div>
    </div>
  );
}
