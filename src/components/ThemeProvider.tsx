'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';

export type Theme = 'dark' | 'black' | 'graphite' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'black',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({
  children,
  initialTheme = 'black',
}: {
  children: React.ReactNode;
  initialTheme?: Theme;
}) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const applyTheme = useCallback((t: Theme) => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.classList.remove('dark', 'theme-black', 'theme-graphite');

      if (t === 'black') {
        root.classList.add('dark', 'theme-black');
        root.setAttribute('data-theme', 'black');
        root.style.colorScheme = 'dark';
      } else if (t === 'graphite') {
        root.classList.add('dark', 'theme-graphite');
        root.setAttribute('data-theme', 'graphite');
        root.style.colorScheme = 'dark';
      } else if (t === 'dark') {
        root.classList.add('dark');
        root.setAttribute('data-theme', 'dark');
        root.style.colorScheme = 'dark';
      } else {
        root.setAttribute('data-theme', 'light');
        root.style.colorScheme = 'light';
      }
      document.cookie = `cookie_theme=${t}; path=/; max-age=31536000; SameSite=Lax`;
      try {
        localStorage.setItem('theme', t);
      } catch (_) {}
    }
    setThemeState(t);
  }, []);

  useEffect(() => {
    try {
      const match = document.cookie.match(/(?:^|; )cookie_theme=([^;]*)/);
      const cookieTheme = match ? decodeURIComponent(match[1]) : null;
      if (cookieTheme === 'dark' || cookieTheme === 'black' || cookieTheme === 'graphite' || cookieTheme === 'light') {
        applyTheme(cookieTheme as Theme);
        return;
      }
      const saved = localStorage.getItem('theme') as Theme | null;
      if (saved === 'dark' || saved === 'black' || saved === 'graphite' || saved === 'light') {
        applyTheme(saved);
        return;
      }
    } catch (_) {}
    applyTheme(initialTheme);
  }, [applyTheme, initialTheme]);

  const toggleTheme = useCallback(() => {
    const nextTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
  }, [theme, applyTheme]);

  const value = useMemo(() => ({
    theme,
    toggleTheme,
    setTheme: applyTheme,
  }), [theme, toggleTheme, applyTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
