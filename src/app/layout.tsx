import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Ruang',
  description: 'Your personal note space',
  manifest: '/manifest.json',
  // White-canvas icon set: dark mark on a rounded white square. Used for the
  // browser tab, the PWA/desktop install and the iOS home screen alike.
  icons: {
    icon: [
      { url: '/logo/ruang-icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo/ruang-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo/ruang-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/logo/ruang-icon-32.png',
    apple: '/logo/ruang-icon-192.png',
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
  // Stops iOS Safari from auto-zooming when a field is focused, which made the
  // note editor jump in and out of zoom while typing.
  maximumScale: 1,
  userScalable: false,
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
        <link rel="apple-touch-icon" href="/logo/ruang-icon-192.png" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
