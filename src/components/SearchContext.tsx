'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface SearchContextType {
  searchValue: string;
  setSearchValue: (val: string) => void;
  triggerSearch: (overrideVal?: string) => void;
}

const SearchContext = createContext<SearchContextType>({
  searchValue: '',
  setSearchValue: () => {},
  triggerSearch: () => {},
});

const DOC_FILTER_PATH = /^\/Docs\/[^/]+\/[^/]+/i;

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchValue, setSearchValue] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/Docs/Search/')) {
      const parts = pathname.replace('/Docs/Search/', '').split('/');
      if (parts[0]) {
        try {
          const decoded = decodeURIComponent(parts[0]);
          setSearchValue(decoded);
        } catch {
          // ignore
        }
      }
    } else if (!DOC_FILTER_PATH.test(pathname)) {
      // Clear search input when leaving search or reloading other pages.
      // Filtered doc pages (`/Docs/<Kind>/<filter>`) are skipped: their DocSearchBar puts the filter
      // into the input from its own effect, and child effects run *before* this one, so clearing
      // here would wipe the value it just set.
      setSearchValue('');
    }
  }, [pathname]);

  const triggerSearch = useCallback((overrideVal?: string) => {
    const raw = overrideVal !== undefined ? overrideVal : searchValue;
    const trimmed = raw.trim();
    if (!trimmed) {
      // Do nothing on empty search - do not redirect to 'Nothing'
      return;
    }
    router.push(`/Docs/Search/${encodeURIComponent(trimmed)}`);
  }, [searchValue, router]);

  const value = useMemo(
    () => ({ searchValue, setSearchValue, triggerSearch }),
    [searchValue, triggerSearch],
  );

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  return useContext(SearchContext);
}
