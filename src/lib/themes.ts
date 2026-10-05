import { ThemeConfig } from './types';

export const THEMES: Record<string, ThemeConfig> = {
  dark: {
    id: 'dark',
    name: 'Dark',
    author: 'MiddleXen',
    bootstrapUrl: '',
    bootstrapFooterText: '',
    colorCss: '',
    footer: 'DenizenM Meta Documentation',
    isDark: true,
  },
  light: {
    id: 'light',
    name: 'Light',
    author: 'MiddleXen',
    bootstrapUrl: '',
    bootstrapFooterText: '',
    colorCss: '',
    footer: 'DenizenM Meta Documentation',
    isDark: false,
  },
};

export const DEFAULT_THEME = THEMES.dark;

export function getTheme(themeName?: string | null): ThemeConfig {
  if (themeName === 'light') return THEMES.light;
  return THEMES.dark;
}
