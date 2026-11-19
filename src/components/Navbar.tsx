'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from './ThemeProvider';
import { useSearchContext } from './SearchContext';
import { Search, ChevronDown, Check, Menu, X, BookOpen } from 'lucide-react';
import { SearchAutocomplete, preloadSuggestions } from './SearchAutocomplete';

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
  const { theme, setTheme } = useTheme();
  const { searchValue, setSearchValue, triggerSearch } = useSearchContext();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileActiveIndex, setMobileActiveIndex] = useState(-1);

  const headerRef = useRef<HTMLElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLDivElement>(null);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    setIsSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleClickOutside = (e: PointerEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
      if (mobileSearchRef.current && !mobileSearchRef.current.contains(e.target as Node)) {
        setMobileSearchOpen(false);
      }
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  // Close theme / mobile dropdowns on Escape
  useEffect(() => {
    if (!themeMenuOpen && !mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setThemeMenuOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [themeMenuOpen, mobileMenuOpen]);

  // Global Ctrl+K / Cmd+K shortcut on all non-Home pages (HomeSearch handles '/')
  useEffect(() => {
    if (pathname === '/') return;
    const handleGlobalCtrlK = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        preloadSuggestions();
        if (window.innerWidth >= 768 && desktopInputRef.current) {
          desktopInputRef.current.focus();
          desktopInputRef.current.select();
        } else {
          setMobileMenuOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 40);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalCtrlK);
    return () => window.removeEventListener('keydown', handleGlobalCtrlK);
  }, [pathname]);

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
      desktopInputRef.current?.blur();
    } else if (e.key === 'Enter') {
      setIsSearchOpen(false);
      const trimmed = searchValue.trim();
      if (!trimmed) return;
      triggerSearch();
    }
  };

  const handleMobileSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setMobileSearchOpen(true);
      setMobileActiveIndex((prev) => prev + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setMobileActiveIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setMobileSearchOpen(false);
      setMobileActiveIndex(-1);
    } else if (e.key === 'Enter') {
      setMobileSearchOpen(false);
      setMobileMenuOpen(false);
      const trimmed = searchValue.trim();
      if (!trimmed) return;
      triggerSearch();
    }
  };

  const lowerPath = pathname.toLowerCase();

  return (
    <>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 top-14 bg-black/45 backdrop-blur-[1px] z-40 xl:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <header
        ref={headerRef}
        className="sticky top-0 z-50 w-full bg-[var(--header-bg)] backdrop-blur-md border-b border-[var(--table-border)]"
      >
        <div className="max-w-[1550px] mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-14 gap-2 sm:gap-4">
            {/* Logo / Brand */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0 no-underline hover:no-underline group">
              <span className="font-display font-bold text-[15px] sm:text-base tracking-tight text-[var(--text-page)] transition-colors flex items-center gap-1.5 select-none">
                <span>DenizenM</span>
                <span className="text-[var(--accent-primary)]">
                  Documentation
                </span>
              </span>
            </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden xl:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const isActive = lowerPath.startsWith(link.href.toLowerCase());
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
                    ? 'bg-[var(--accent-soft)] text-[var(--text-page)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-page)] hover:bg-[var(--accent-soft)]'
                }`}
              >
                <span className="leading-none">Theme</span>
                <ChevronDown className={`w-3 h-3 opacity-60 transition-transform duration-150 ${themeMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {themeMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-[var(--card-bg)] border border-[var(--table-border)] shadow-xl py-1.5 z-50 animate-fade-in">
                  <div className="px-3 py-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                    Select Theme
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTheme('black');
                      setThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                      theme === 'black'
                        ? 'bg-[var(--accent-soft)] text-[var(--text-page)] font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-page)] hover:bg-[var(--code-bg)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="theme-dot theme-dot-black"></span>
                      <span>Pitch Black</span>
                    </div>
                    {theme === 'black' && <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTheme('dark');
                      setThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                      theme === 'dark'
                        ? 'bg-[var(--accent-soft)] text-[var(--text-page)] font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-page)] hover:bg-[var(--code-bg)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="theme-dot theme-dot-emerald"></span>
                      <span>Emerald</span>
                    </div>
                    {theme === 'dark' && <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTheme('graphite');
                      setThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                      theme === 'graphite'
                        ? 'bg-[var(--accent-soft)] text-[var(--text-page)] font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-page)] hover:bg-[var(--code-bg)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="theme-dot theme-dot-graphite"></span>
                      <span>Graphite</span>
                    </div>
                    {theme === 'graphite' && <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
                  </button>

                  <div className="my-1 border-t border-[var(--row-border)]" />

                  <button
                    type="button"
                    onClick={() => {
                      setTheme('light');
                      setThemeMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-left transition-colors cursor-pointer ${
                      theme === 'light'
                        ? 'bg-[var(--accent-soft)] text-[var(--text-page)] font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-page)] hover:bg-[var(--code-bg)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="theme-dot theme-dot-light"></span>
                      <span>Light</span>
                    </div>
                    {theme === 'light' && <Check className="w-3.5 h-3.5 text-[var(--accent-primary)]" />}
                  </button>
                </div>
              )}
            </div>
          </nav>

          {/* Search bar & External Links */}
          <div className="flex items-center gap-2 md:flex-1 md:max-w-sm justify-end">
            <div className="hidden md:block relative w-full max-w-xs z-[999]" ref={searchContainerRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)] pointer-events-none" />
              <input
                ref={desktopInputRef}
                type="text"
                placeholder="Search all meta..."
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
                  preloadSuggestions();
                  if (searchValue.trim()) setIsSearchOpen(true);
                }}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-8.5 pr-8 py-1.5 rounded-lg text-xs bg-[var(--input-bg)] border border-[var(--table-border)] text-[var(--text-page)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-soft)] transition-all"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchValue('');
                    setIsSearchOpen(false);
                    desktopInputRef.current?.focus();
                  }}
                  aria-label="Clear global search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-page)] cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}

              <SearchAutocomplete
                query={searchValue}
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                activeIndex={searchActiveIndex}
                setActiveIndex={setSearchActiveIndex}
              />
            </div>

            {/* Quick external links */}
            <div className="hidden sm:flex items-center gap-1 border-l border-[var(--table-border)] pl-2">
              <a
                href="https://guide.denizenscript.com/"
                target="_blank"
                rel="noreferrer"
                title="Beginner's Guide"
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-page)] hover:bg-[var(--accent-soft)] transition-colors"
              >
                <BookOpen className="w-4 h-4" />
              </a>
              <a
                href="https://discord.gg/F2nftfP3nq"
                target="_blank"
                rel="noreferrer"
                title="Denizen Discord"
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[#5865F2] hover:bg-[var(--accent-soft)] transition-colors"
              >
                <DiscordIcon className="w-4 h-4" />
              </a>
            </div>

            {/* Mobile global search button */}
            {pathname !== '/' && (
              <button
                type="button"
                onClick={() => {
                  preloadSuggestions();
                  setMobileMenuOpen(true);
                  setTimeout(() => mobileInputRef.current?.focus(), 40);
                }}
                aria-label="Open global search"
                className="md:hidden relative w-9.5 h-9.5 rounded-lg border border-[var(--table-border)] text-[var(--text-muted)] hover:text-[var(--text-page)] bg-[var(--card-bg)] flex items-center justify-center cursor-pointer transition-colors"
              >
                <Search className="w-4 h-4" />
              </button>
            )}

            {/* Mobile menu toggle button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="xl:hidden relative w-9.5 h-9.5 rounded-lg border border-[var(--table-border)] text-[var(--text-muted)] hover:text-[var(--text-page)] bg-[var(--card-bg)] flex items-center justify-center cursor-pointer transition-colors"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Nav */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-[var(--table-border)] py-3.5 flex flex-col gap-3.5 max-h-[calc(100dvh-3.5rem)] overflow-y-auto overscroll-contain">
            {/* Global Search inside Mobile Menu */}
            <div className="md:hidden relative z-[999]" ref={mobileSearchRef}>
              <div className="search-shell relative flex items-center w-full rounded-lg bg-[var(--input-bg)] border border-[var(--table-border)]">
                <Search className="ml-3 w-4 h-4 text-[var(--text-muted)] pointer-events-none flex-shrink-0" />
                <input
                  ref={mobileInputRef}
                  type="text"
                  placeholder="Search all meta documentation..."
                  value={searchValue}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  onChange={(e) => {
                    setSearchValue(e.target.value);
                    setMobileSearchOpen(true);
                    setMobileActiveIndex(-1);
                  }}
                  onFocus={() => {
                    preloadSuggestions();
                    if (searchValue.trim()) setMobileSearchOpen(true);
                  }}
                  onKeyDown={handleMobileSearchKeyDown}
                  className="flex-1 min-w-0 px-2.5 py-2 bg-transparent text-base sm:text-sm text-[var(--text-page)] placeholder-[var(--text-muted)] focus:outline-none"
                />
                {searchValue && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchValue('');
                      setMobileSearchOpen(false);
                      mobileInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="mr-1.5 w-8 h-8 flex items-center justify-center rounded-md text-[var(--text-muted)] hover:text-[var(--text-page)] flex-shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <SearchAutocomplete
                query={searchValue}
                isOpen={mobileSearchOpen}
                onClose={() => {
                  setMobileSearchOpen(false);
                  setMobileMenuOpen(false);
                }}
                activeIndex={mobileActiveIndex}
                setActiveIndex={setMobileActiveIndex}
                inline
              />
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                Navigation
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {NAV_LINKS.map((link) => {
                  const isActive = lowerPath.startsWith(link.href.toLowerCase());
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`px-3 py-2.5 rounded-lg text-xs font-semibold text-left border transition-colors ${
                        isActive
                          ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] border-[var(--accent-border)]'
                          : 'bg-[var(--code-bg)] text-[var(--text-page)] border-[var(--table-border)]'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-2.5 border-t border-[var(--row-border)] flex flex-col gap-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                Theme
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTheme('black')}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 border cursor-pointer ${
                    theme === 'black'
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-bold border-[var(--accent-border)] shadow-xs'
                      : 'bg-[var(--code-bg)] text-[var(--text-muted)] border-[var(--table-border)]'
                  }`}
                >
                  <span className="theme-dot-sm theme-dot-black"></span>
                  <span>Pitch Black</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 border cursor-pointer ${
                    theme === 'dark'
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-bold border-[var(--accent-border)] shadow-xs'
                      : 'bg-[var(--code-bg)] text-[var(--text-muted)] border-[var(--table-border)]'
                  }`}
                >
                  <span className="theme-dot-sm theme-dot-emerald"></span>
                  <span>Emerald</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('graphite')}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 border cursor-pointer ${
                    theme === 'graphite'
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-bold border-[var(--accent-border)] shadow-xs'
                      : 'bg-[var(--code-bg)] text-[var(--text-muted)] border-[var(--table-border)]'
                  }`}
                >
                  <span className="theme-dot-sm theme-dot-graphite"></span>
                  <span>Graphite</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium flex items-center gap-2 border cursor-pointer ${
                    theme === 'light'
                      ? 'bg-[var(--accent-soft)] text-[var(--accent-primary)] font-bold border-[var(--accent-border)] shadow-xs'
                      : 'bg-[var(--code-bg)] text-[var(--text-muted)] border-[var(--table-border)]'
                  }`}
                >
                  <span className="theme-dot-sm theme-dot-light"></span>
                  <span>Light</span>
                </button>
              </div>
            </div>

            <div className="sm:hidden pt-2.5 border-t border-[var(--row-border)] flex items-center gap-2">
              <a
                href="https://guide.denizenscript.com/"
                target="_blank"
                rel="noreferrer"
                className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--code-bg)] text-[var(--text-page)] border border-[var(--table-border)] inline-flex items-center justify-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Beginner&apos;s Guide</span>
              </a>
              <a
                href="https://discord.gg/F2nftfP3nq"
                target="_blank"
                rel="noreferrer"
                className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-[var(--code-bg)] text-[var(--text-page)] border border-[var(--table-border)] inline-flex items-center justify-center gap-1.5"
              >
                <DiscordIcon className="w-3.5 h-3.5 text-[#5865F2]" />
                <span>Discord</span>
              </a>
            </div>
          </div>
        )}
        </div>
      </header>
    </>
  );
}
