'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Zap, Layers, ListFilter, X, Search } from 'lucide-react';
import type { AsyncFilterCounts, PluginFilterOption } from '@/lib/types';
import { doFlashFor } from '@/lib/flasher';
import { getDocRestController, restCardMatches } from '@/lib/doc-rest-registry';

interface DocFilterBarProps {
  containerId: string;
  basePath: string;
  itemPlural: string;
  isAll: boolean;
  currentlyShown: number;
  max: number;
  searchText: string | null;
  categories: string[];
  asyncCounts?: AsyncFilterCounts;
  pluginOptions?: PluginFilterOption[];
}

interface CategoryItem {
  label: string;
  anchorId: string;
}

const toDefaultCategoryItems = (cats: string[]): CategoryItem[] =>
  cats.map((c) => ({
    label: c,
    anchorId: encodeURIComponent(c.toLowerCase()),
  }));

function cardMatches(card: HTMLElement, asyncFilter: string, pluginFilter: string): boolean {
  if (asyncFilter) {
    const tokens = (card.dataset.async || '').split(/\s+/);
    if (!tokens.includes(asyncFilter)) return false;
  }
  if (pluginFilter) {
    if (card.dataset.plugin !== pluginFilter) return false;
  }
  return true;
}

export function DocFilterBar({
  containerId,
  basePath,
  itemPlural,
  isAll,
  currentlyShown,
  max,
  searchText,
  categories,
  asyncCounts,
  pluginOptions,
}: DocFilterBarProps) {
  const [asyncFilter, setAsyncFilter] = useState<string>('');
  const [pluginFilter, setPluginFilter] = useState<string>('');
  const [filteredCount, setFilteredCount] = useState<number | null>(null);
  const [activeCategories, setActiveCategories] = useState<CategoryItem[]>(() =>
    toDefaultCategoryItems(categories)
  );
  const [catOpen, setCatOpen] = useState(false);
  const [catQuery, setCatQuery] = useState('');
  const [scrolledDown, setScrolledDown] = useState(false);
  const catPopoverRef = useRef<HTMLDivElement>(null);

  const isObjectTypes = basePath.includes('/ObjectTypes');
  const deferLabel = isObjectTypes ? 'Partial Async' : 'Deferrable';

  // Reset filters when route / search changes
  useEffect(() => {
    setAsyncFilter('');
    setPluginFilter('');
    setFilteredCount(null);
    setActiveCategories(toDefaultCategoryItems(categories));
    setCatOpen(false);
    setCatQuery('');
  }, [basePath, searchText, categories]);

  const syncDomFilters = useCallback(() => {
    const root = document.getElementById(containerId);
    if (!root) return;

    if (asyncFilter) root.setAttribute('data-filter-async', asyncFilter);
    else root.removeAttribute('data-filter-async');

    if (pluginFilter) root.setAttribute('data-filter-plugin', pluginFilter);
    else root.removeAttribute('data-filter-plugin');

    const isFiltering = Boolean(asyncFilter || pluginFilter);
    const restCtrl = getDocRestController(containerId);

    if (!isFiltering) {
      root.querySelectorAll<HTMLElement>('.category_header_block').forEach((hdr) => {
        if (hdr.style.display) hdr.style.display = '';
      });
      root.querySelectorAll<HTMLElement>('[data-category-chip]').forEach((chip) => {
        if (chip.style.display) chip.style.display = '';
      });
      restCtrl?.applyFilterState('', '', new Set());

      const catWrapper = root.querySelector<HTMLElement>('.categories_wrapper');
      if (catWrapper) {
        catWrapper.style.display = '';
        const badge = catWrapper.querySelector('.categories_badge');
        if (badge) badge.textContent = String(categories.length);
      }

      setActiveCategories(toDefaultCategoryItems(categories));
      setFilteredCount(null);
      return;
    }

    let totalMatched = 0;
    const visibleCategories = new Set<string>();

    if (restCtrl) {
      const headScope = root.querySelector('.doc-head') || root;
      const headNodes = headScope.querySelectorAll<HTMLElement>('.category_header_block, .doc-card');
      let currentHeader: HTMLElement | null = null;
      let currentCatId = '';
      let currentHasMatch = false;

      const flushHeadHeader = () => {
        if (currentHeader && currentHasMatch && currentCatId) {
          visibleCategories.add(currentCatId);
        }
      };

      headNodes.forEach((node) => {
        if (node.closest('.related-matches-body')) return;
        if (node.classList.contains('category_header_block')) {
          flushHeadHeader();
          currentHeader = node;
          currentCatId = node.dataset.categoryHeader || '';
          currentHasMatch = false;
        } else if (node.classList.contains('doc-card')) {
          if (cardMatches(node, asyncFilter, pluginFilter)) {
            currentHasMatch = true;
            totalMatched++;
          }
        }
      });
      flushHeadHeader();

      for (const chunk of restCtrl.chunks) {
        for (const card of chunk.cards) {
          if (restCardMatches(card, asyncFilter, pluginFilter)) {
            totalMatched++;
            if (card.catId) visibleCategories.add(card.catId);
          }
        }
      }

      headScope.querySelectorAll<HTMLElement>('.category_header_block').forEach((hdr) => {
        const catId = hdr.dataset.categoryHeader || '';
        hdr.style.display = visibleCategories.has(catId) ? '' : 'none';
      });

      restCtrl.applyFilterState(asyncFilter, pluginFilter, visibleCategories);
    } else {
      // Fallback walk before rest chunks register (or on small sections without restUrl)
      const nodes = root.querySelectorAll<HTMLElement>('.category_header_block, .doc-card');
      let currentHeader: HTMLElement | null = null;
      let currentHeaderHasMatch = false;

      const flushHeader = () => {
        if (!currentHeader) return;
        const catId = currentHeader.dataset.categoryHeader || '';
        if (currentHeaderHasMatch) {
          currentHeader.style.display = '';
          if (catId) visibleCategories.add(catId);
        } else {
          currentHeader.style.display = 'none';
        }
      };

      nodes.forEach((node) => {
        if (node.closest('.related-matches-body')) return;
        if (node.classList.contains('category_header_block')) {
          flushHeader();
          currentHeader = node;
          currentHeaderHasMatch = false;
        } else if (node.classList.contains('doc-card')) {
          if (cardMatches(node, asyncFilter, pluginFilter)) {
            currentHeaderHasMatch = true;
            totalMatched++;
          }
        }
      });
      flushHeader();
    }

    // Sync category chips at top of page
    const chips = root.querySelectorAll<HTMLElement>('[data-category-chip]');
    const nextActiveCategories: CategoryItem[] = [];
    let visibleChipCount = 0;
    chips.forEach((chip) => {
      const id = chip.dataset.categoryChip || '';
      if (visibleCategories.has(id)) {
        chip.style.display = '';
        visibleChipCount++;
        const label = (chip.textContent || '').trim();
        if (id && label) {
          nextActiveCategories.push({ label, anchorId: id });
        }
      } else {
        chip.style.display = 'none';
      }
    });

    const catWrapper = root.querySelector<HTMLElement>('.categories_wrapper');
    if (catWrapper) {
      catWrapper.style.display = visibleChipCount === 0 ? 'none' : '';
      const badge = catWrapper.querySelector('.categories_badge');
      if (badge) {
        badge.textContent = String(visibleChipCount);
      }
    }

    const nextCats = chips.length > 0 ? nextActiveCategories : [];
    setActiveCategories(nextCats);
    if (nextCats.length <= 1) {
      setCatOpen(false);
    }

    setFilteredCount(totalMatched);
  }, [containerId, asyncFilter, pluginFilter, categories]);

  useEffect(() => {
    const raf = requestAnimationFrame(syncDomFilters);
    const onRestLoaded = () => syncDomFilters();
    const onResetFilters = () => {
      setAsyncFilter('');
      setPluginFilter('');
    };
    window.addEventListener('agy:doc-rest-loaded', onRestLoaded);
    window.addEventListener('agy:reset-doc-filters', onResetFilters);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('agy:doc-rest-loaded', onRestLoaded);
      window.removeEventListener('agy:reset-doc-filters', onResetFilters);
    };
  }, [syncDomFilters]);

  // Show floating category button when scrolled down on multi-category pages
  useEffect(() => {
    if (categories.length <= 4) return;
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          setScrolledDown(window.scrollY > 400);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [categories.length]);

  useEffect(() => {
    if (!catOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (catPopoverRef.current && !catPopoverRef.current.contains(e.target as Node)) {
        setCatOpen(false);
      }
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCatOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onEscape);
    };
  }, [catOpen]);

  const filteredCategories = useMemo(() => {
    const q = catQuery.trim().toLowerCase();
    if (!q) return activeCategories;
    return activeCategories.filter((c) => c.label.toLowerCase().includes(q));
  }, [activeCategories, catQuery]);

  const hasFilterControls =
    (asyncCounts && (asyncCounts.safe > 0 || asyncCounts.defer > 0)) ||
    (pluginOptions && pluginOptions.length > 1);

  const isFiltering = Boolean(asyncFilter || pluginFilter);

  return (
    <>
      <div className="mt-3.5 mb-2 relative z-10 flex flex-col items-center gap-2.5 px-2">
        {/* Status Counter Pill */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {isFiltering && filteredCount !== null ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-2xs leading-none">
              <span>Showing</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {filteredCount.toLocaleString()}
              </strong>
              <span>filtered of {currentlyShown.toLocaleString()} {itemPlural}</span>
              <button
                type="button"
                onClick={() => {
                  setAsyncFilter('');
                  setPluginFilter('');
                }}
                className="ml-1 inline-flex items-center gap-0.5 text-[11px] font-semibold text-rose-500 hover:text-rose-400 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            </span>
          ) : isAll ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-2xs leading-none">
              <span>Showing all</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {max.toLocaleString()}
              </strong>
              <span>{itemPlural}</span>
            </span>
          ) : searchText ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-2xs leading-none flex-wrap justify-center">
              <span>Showing</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {currentlyShown.toLocaleString()}
              </strong>
              <span>results for</span>
              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-emerald-600 dark:text-emerald-400 font-mono text-[11px] leading-tight">
                {searchText}
              </span>
              <span>out of {max.toLocaleString()} {itemPlural}</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 shadow-2xs leading-none">
              <span>Showing</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                {currentlyShown.toLocaleString()}
              </strong>
              <span>results out of {max.toLocaleString()} {itemPlural}</span>
            </span>
          )}
        </div>

        {/* Instant 0ms Async & Source Filter Chips */}
        {hasFilterControls && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-4xl">
            {asyncCounts && (asyncCounts.safe > 0 || asyncCounts.defer > 0) && (
              <div className="inline-flex flex-wrap items-center justify-center gap-1 p-1 rounded-xl bg-white dark:bg-[#0c0e14] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
                <button
                  type="button"
                  onClick={() => setAsyncFilter('')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold leading-none transition-colors cursor-pointer ${
                    asyncFilter === ''
                      ? 'bg-slate-900 text-white dark:bg-white/15 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All Threads
                </button>
                {asyncCounts.safe > 0 && (
                  <button
                    type="button"
                    onClick={() => setAsyncFilter(asyncFilter === 'safe' ? '' : 'safe')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold leading-none transition-colors cursor-pointer ${
                      asyncFilter === 'safe'
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-[#00efb2] border border-emerald-500/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-[#00bc8c]'
                    }`}
                  >
                    <Zap className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <span>Async-Safe</span>
                    <span className="opacity-65 font-mono text-[10px]">{asyncCounts.safe}</span>
                  </button>
                )}
                {asyncCounts.defer > 0 && (
                  <button
                    type="button"
                    onClick={() => setAsyncFilter(asyncFilter === 'defer' ? '' : 'defer')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold leading-none transition-colors cursor-pointer ${
                      asyncFilter === 'defer'
                        ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400'
                    }`}
                  >
                    <span>{deferLabel}</span>
                    <span className="opacity-65 font-mono text-[10px]">{asyncCounts.defer}</span>
                  </button>
                )}
                {asyncCounts.main > 0 && (
                  <button
                    type="button"
                    onClick={() => setAsyncFilter(asyncFilter === 'main' ? '' : 'main')}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold leading-none transition-colors cursor-pointer ${
                      asyncFilter === 'main'
                        ? 'bg-slate-200 dark:bg-white/15 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>Main Thread</span>
                    <span className="opacity-65 font-mono text-[10px]">{asyncCounts.main}</span>
                  </button>
                )}
              </div>
            )}

            {pluginOptions && pluginOptions.length > 1 && (
              <div className="inline-flex flex-wrap items-center justify-center gap-1 p-1 rounded-xl bg-white dark:bg-[#0c0e14] border border-slate-200/80 dark:border-white/[0.08] shadow-2xs">
                <span className="pl-1.5 pr-0.5 text-slate-400 hidden sm:inline-flex items-center" title="Filter by plugin source">
                  <Layers className="w-3 h-3" />
                </span>
                <button
                  type="button"
                  onClick={() => setPluginFilter('')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold leading-none transition-colors cursor-pointer ${
                    pluginFilter === ''
                      ? 'bg-slate-900 text-white dark:bg-white/15 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All Sources
                </button>
                {pluginOptions.map((opt) => (
                  <button
                    key={opt.slug}
                    type="button"
                    onClick={() => setPluginFilter(pluginFilter === opt.slug ? '' : opt.slug)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold leading-none transition-colors cursor-pointer ${
                      pluginFilter === opt.slug
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-[#00efb2] border border-emerald-500/40'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="opacity-65 font-mono text-[10px]">{opt.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {isFiltering && filteredCount === 0 && (
          <div className="mt-4 w-full max-w-md mx-auto px-5 py-6 rounded-xl bg-white dark:bg-[#0c0e14] border border-slate-200 dark:border-white/10 text-center shadow-sm">
            <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
              No entries match the combination of selected filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setAsyncFilter('');
                setPluginFilter('');
              }}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Floating Quick-Jump Categories Popover when scrolled down on long pages */}
      {categories.length > 4 && activeCategories.length > 1 && scrolledDown && (
        <div ref={catPopoverRef} className="fixed bottom-6 right-17 z-40">
          {catOpen && (
            <div className="absolute bottom-11 right-0 w-64 sm:w-72 rounded-xl bg-white dark:bg-[#12161f] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden animate-fade-in">
              <div className="p-2 border-b border-slate-200/80 dark:border-white/10 flex items-center gap-2 bg-slate-50/80 dark:bg-black/25">
                <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 ml-1" />
                <input
                  type="text"
                  value={catQuery}
                  onChange={(e) => setCatQuery(e.target.value)}
                  placeholder={`Jump to category (${activeCategories.length})...`}
                  autoFocus
                  className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none py-0.5"
                />
                {catQuery && (
                  <button
                    type="button"
                    onClick={() => setCatQuery('')}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto p-1.5 grid grid-cols-1 gap-0.5">
                {filteredCategories.length > 0 ? (
                  filteredCategories.map((item) => (
                    <button
                      key={item.anchorId}
                      type="button"
                      onClick={() => {
                        setCatOpen(false);
                        doFlashFor(item.anchorId);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer truncate"
                    >
                      {item.label}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-xs text-center text-slate-400">
                    No matching categories
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCatOpen((v) => !v)}
            aria-label="Jump to category"
            className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg bg-white/95 dark:bg-[#151921]/95 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-sm text-xs font-semibold transition-colors cursor-pointer"
          >
            <ListFilter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Categories</span>
            <span className="font-mono text-[10px] opacity-70">{activeCategories.length}</span>
          </button>
        </div>
      )}
    </>
  );
}
