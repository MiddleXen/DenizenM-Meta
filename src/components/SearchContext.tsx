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

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const [searchValue, setSearchValue] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.toLowerCase().startsWith('/docs/search/')) {
      const rest = pathname.slice('/Docs/Search/'.length);
      if (rest) {
        try {
          setSearchValue(decodeURIComponent(rest));
        } catch {
          setSearchValue(rest);
        }
      }
    } else {
      setSearchValue('');
    }
  }, [pathname]);

  const triggerSearch = useCallback((overrideVal?: string) => {
    const raw = overrideVal !== undefined ? overrideVal : searchValue;
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }
    const target = `/Docs/Search/${encodeURIComponent(trimmed)}`;
    if (typeof window !== 'undefined' && window.location.pathname !== target) {
      window.dispatchEvent(new CustomEvent('agy:nav-start'));
    }
    router.push(target);
  }, [searchValue, router]);

  const value = useMemo(
    () => ({ searchValue, setSearchValue, triggerSearch }),
    [searchValue, triggerSearch]
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
