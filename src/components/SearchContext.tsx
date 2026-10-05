'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
    } else {
      // Clear search input when leaving search or reloading other pages
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

  return (
    <SearchContext.Provider value={{ searchValue, setSearchValue, triggerSearch }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  return useContext(SearchContext);
}
