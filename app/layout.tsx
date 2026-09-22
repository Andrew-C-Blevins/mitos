import type { Metadata, Viewport } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';
import { AuthProvider } from '@/components/auth-provider';
import { AppShell } from '@/components/app-shell';
import './globals.css';
const sans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const display = Fraunces({ subsets: ['latin'], variable: '--font-fraunces' });
export const metadata: Metadata = {
  title: 'Mitos',
  description: 'A shared household action system.',
  icons: { icon: '/apple-icon' },
  appleWebApp: { capable: true, title: 'Mitos', statusBarStyle: 'default' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#eaeae5' },
    { media: '(prefers-color-scheme: dark)', color: '#252b2b' },
  ],
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable}`}>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
