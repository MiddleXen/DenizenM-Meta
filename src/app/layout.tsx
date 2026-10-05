import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ThemeProvider, Theme } from '@/components/ThemeProvider';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { SearchProvider } from '@/components/SearchContext';
import { BackToTop } from '@/components/BackToTop';
import { NavigationProgressBar } from '@/components/NavigationProgressBar';
import { InteractiveBackground } from '@/components/InteractiveBackground';
import { Suspense } from 'react';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'DenizenM Meta Documentation',
  description: 'Fast, high-performance meta-documentation explorer for DenizenM script commands, tags, events, mechanisms, and object types.',
  keywords: ['DenizenM', 'Denizen', 'DenizenScript', 'Minecraft', 'Scripting', 'Tags', 'Commands', 'Mechanisms', 'Events'],
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body className="min-h-screen flex flex-col antialiased selection:bg-emerald-500/20 selection:text-emerald-400 relative">
        <InteractiveBackground />

        <ThemeProvider initialTheme={initialTheme}>
          <Suspense fallback={null}>
            <NavigationProgressBar />
          </Suspense>
          <SearchProvider>
            <Navbar />
            <main className="flex-1 w-full relative z-0">
              {children}
            </main>
            <Footer />
            <BackToTop />
          </SearchProvider>
        </ThemeProvider>

        <Script src="/js/flasher.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
