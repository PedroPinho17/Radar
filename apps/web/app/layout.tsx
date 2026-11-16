import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ThemeProvider } from 'next-themes';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { Nav } from '@/components/nav';
import { SiteFooter } from '@/components/site-footer';

const geistSans = localFont({ src: './fonts/GeistVF.woff', variable: '--font-sans' });
const geistMono = localFont({ src: './fonts/GeistMonoVF.woff', variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: { default: 'Radar', template: '%s · Radar' },
  description: 'O teu assistente de procura de emprego',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafc' },
    { media: '(prefers-color-scheme: dark)', color: '#16161d' },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-PT" className={`${geistSans.variable} ${geistMono.variable} font-sans`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Nav />
          {children}
          <SiteFooter />
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
