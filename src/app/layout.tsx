import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { ThemeProvider, Theme } from '@/components/ThemeProvider';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SearchProvider } from '@/components/SearchContext';
import { BackToTop } from '@/components/BackToTop';
import { NavigationProgressBar } from '@/components/NavigationProgressBar';
import { FlasherInit } from '@/components/FlasherInit';
import { Suspense } from 'react';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#080a0f' },
  ],
};

export const metadata: Metadata = {
  title: 'DenizenM Meta Documentation',
  description: 'Fast, high-performance meta-documentation explorer for DenizenM script commands, tags, events, mechanisms, and object types.',
  keywords: ['DenizenM', 'Denizen', 'DenizenScript', 'Minecraft', 'Scripting', 'Tags', 'Commands', 'Mechanisms', 'Events'],
  openGraph: {
    title: 'DenizenM Meta Documentation',
    description: 'Fast, high-performance meta-documentation explorer for DenizenM script commands, tags, events, mechanisms, and object types.',
    siteName: 'DenizenM Meta Documentation',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'DenizenM Meta Documentation',
    description: 'Fast, high-performance meta-documentation explorer for DenizenM script commands, tags, events, mechanisms, and object types.',
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('cookie_theme')?.value;
  const initialTheme: Theme =
    themeCookie === 'dark' ? 'dark' :
    themeCookie === 'graphite' ? 'graphite' :
    themeCookie === 'light' ? 'light' : 'black';
  const htmlClass =
    initialTheme === 'black' ? 'dark theme-black' :
    initialTheme === 'graphite' ? 'dark theme-graphite' :
    initialTheme === 'dark' ? 'dark' : '';

  return (
    <html lang="en" className={htmlClass} data-theme={initialTheme} suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="dark light" />
      </head>
      <body className="min-h-screen flex flex-col antialiased selection:bg-emerald-500/20 selection:text-emerald-400">
        <ThemeProvider initialTheme={initialTheme}>
          <Suspense fallback={null}>
            <NavigationProgressBar />
          </Suspense>
          <SearchProvider>
            <Navbar />
            <main className="flex-1 w-full flex flex-col relative z-10">
              {children}
            </main>
            <Footer />
            <BackToTop />
          </SearchProvider>
          <FlasherInit />
        </ThemeProvider>
      </body>
    </html>
  );
}
