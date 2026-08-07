import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Ruang',
  description: 'Your personal note space',
  manifest: '/manifest.json',
  icons: {
    icon: '/logo/ruang_logo.png',
    apple: '/logo/ruang_logo.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Ruang',
  },
};

export const viewport: Viewport = {
  themeColor: '#A1B5D8',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,300;0,400;0,500;1,400&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/logo/ruang_logo.png" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
