'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useSearchContext } from './SearchContext';
import { Search, ChevronDown, Check, Menu, X, BookOpen } from 'lucide-react';
import { SearchAutocomplete } from './SearchAutocomplete';

const NAV_LINKS = [
  { href: '/Docs/Commands', label: 'Commands' },
  { href: '/Docs/Tags', label: 'Tags' },
  { href: '/Docs/ObjectTypes', label: 'Object Types' },
  { href: '/Docs/Mechanisms', label: 'Mechanisms' },
  { href: '/Docs/Events', label: 'Events' },
  { href: '/Docs/Languages', label: 'Languages' },
  { href: '/Docs/Actions', label: 'NPC Actions' },
];

function DiscordIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { searchValue, setSearchValue, triggerSearch } = useSearchContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsSearchOpen(true);
      setSearchActiveIndex((prev) => prev + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearchActiveIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setSearchActiveIndex(-1);
    } else if (e.key === 'Enter') {
      setIsSearchOpen(false);
      const trimmed = searchValue.trim();
      if (!trimmed) return;
      triggerSearch();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-[#0a0d12]/90 backdrop-blur-md border-b border-slate-200/90 dark:border-white/10">
      <div className="max-w-[1550px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-4">
          {/* Logo / Brand */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 no-underline hover:no-underline group">
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white transition-colors flex items-center gap-1.5 select-none">
              <span>DenizenM</span>
              <span className="text-emerald-500 dark:text-[#00bc8c]">
                Documentation
              </span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden xl:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`nav-tab-link px-3 py-1.5 rounded-lg text-xs font-semibold no-underline hover:no-underline transition-all duration-150 select-none ${
                    isActive ? 'nav-tab-active' : 'nav-tab-idle'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            {/* Theme Dropdown */}
            <div className="relative ml-1.5" ref={themeMenuRef}>
              <button
                type="button"
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 leading-none transition-all cursor-pointer ${
                  themeMenuOpen
                    ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
              >
                <span className="leading-none">Theme</span>
                <ChevronDown className={`w-3 h-3 opacity-60 transition-transform duration-150 ${themeMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {themeMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-white dark:bg-[#12161f] border border-slate-200 dark:border-white/10 shadow-xl py-1.5 z-50 animate-fade-in">
                  <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Select Theme
                  </div>

                  {/* 1. Pitch Black */}
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('black');
                      setThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                      theme === 'black'
                        ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="theme-dot theme-dot-black"></span>
                      <span>Pitch Black</span>
                    </div>
                    {theme === 'black' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                  </button>

                  {/* 2. Emerald */}
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('dark');
                      setThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="theme-dot theme-dot-emerald"></span>
                      <span>Emerald</span>
                    </div>
                    {theme === 'dark' && <Check className="w-3.5 h-3.5 text-[#00bc8c]" />}
                  </button>

                  {/* 3. Graphite Dark */}
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('graphite');
                      setThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                      theme === 'graphite'
                        ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="theme-dot theme-dot-graphite"></span>
                      <span>Graphite</span>
                    </div>
                    {theme === 'graphite' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                  </button>

                  <div className="my-1 border-t border-slate-200 dark:border-white/10" />

                  {/* 4. Light */}
                  <button
                    type="button"
                    onClick={() => {
                      setTheme('light');
                      setThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="theme-dot theme-dot-light"></span>
                      <span>Light</span>
                    </div>
                    {theme === 'light' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* Search bar & External Links */}
          <div className="flex items-center gap-2 md:flex-1 md:max-w-sm justify-end">
            <div className="hidden md:block relative w-full max-w-xs z-[999]" ref={searchContainerRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search meta..."
                value={searchValue}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(e) => {
                  setSearchValue(e.target.value);
                  setIsSearchOpen(true);
                  setSearchActiveIndex(-1);
                }}
                onFocus={() => {
                  if (searchValue.trim()) setIsSearchOpen(true);
                }}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-8.5 pr-8 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all shadow-inner"
              />
              <kbd className="hidden sm:inline-flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 px-1.5 h-4.5 text-[9px] font-mono font-semibold leading-none text-slate-400 bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded">
                ↵
              </kbd>

              <SearchAutocomplete
                query={searchValue}
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                activeIndex={searchActiveIndex}
                setActiveIndex={setSearchActiveIndex}
              />
            </div>

            {/* Quick external links */}
            <div className="hidden sm:flex items-center gap-1 border-l border-slate-200 dark:border-white/10 pl-2">
              <a
                href="https://guide.denizenscript.com/"
                target="_blank"
                rel="noreferrer"
                title="Beginner's Guide"
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <BookOpen className="w-4 h-4" />
              </a>
              <a
                href="https://discord.gg/F2nftfP3nq"
                target="_blank"
                rel="noreferrer"
                title="Denizen Discord"
                className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-[#5865F2] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <DiscordIcon className="w-4 h-4" />
              </a>
            </div>

            {/* Mobile menu toggle button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="xl:hidden relative w-8.5 h-8.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-white/5 flex items-center justify-center cursor-pointer transition-colors"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Nav */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-slate-200 dark:border-white/10 py-3.5 flex flex-col gap-3.5">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Navigation
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {NAV_LINKS.map((link) => {
                  const isActive = pathname.startsWith(link.href);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-3 py-2 rounded-lg text-xs font-semibold text-left border transition-colors ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-white/10'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-200 dark:border-white/10 flex flex-col gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Theme
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTheme('black')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border ${
                    theme === 'black'
                      ? 'bg-white/20 text-white font-bold border-white/40 shadow-xs'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <span className="theme-dot-sm theme-dot-black"></span>
                  <span>Pitch Black</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border ${
                    theme === 'dark'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-[#00bc8c] font-bold border-emerald-500/30 shadow-xs'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <span className="theme-dot-sm theme-dot-emerald"></span>
                  <span>Emerald</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('graphite')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border ${
                    theme === 'graphite'
                      ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400 font-bold border-sky-500/30 shadow-xs'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <span className="theme-dot-sm theme-dot-graphite"></span>
                  <span>Graphite</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border ${
                    theme === 'light'
                      ? 'bg-amber-500/15 text-amber-700 font-bold border-amber-500/30 shadow-xs'
                      : 'bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10'
                  }`}
                >
                  <span className="theme-dot-sm theme-dot-light"></span>
                  <span>Light</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
