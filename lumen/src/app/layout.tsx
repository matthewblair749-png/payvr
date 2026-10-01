import type { Metadata } from 'next';
import localFont from 'next/font/local';

import { Providers } from '@/components/providers';
import { AppShell } from '@/components/shell/app-shell';
import { prefsScript } from '@/lib/prefs';

import './globals.css';

const sora = localFont({
  src: [{ path: './fonts/sora-latin-700-normal.woff2', weight: '700', style: 'normal' }],
  variable: '--font-sora',
  display: 'swap',
});

const dmSans = localFont({
  src: [
    { path: './fonts/dm-sans-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/dm-sans-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/dm-sans-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lumen',
  description: 'Checkout and payments for creators and small brands.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-theme / data-sidebar are set by the inline script before paint.
    <html lang="en" className={`${sora.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: prefsScript }} />
      </head>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
