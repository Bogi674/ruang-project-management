/** @type {import('next').NextConfig} */

/*
 * Content-Security-Policy.
 *
 * 'unsafe-inline' on style-src is required and not easily removable: the app
 * sets CSS custom properties through React `style` props (the theme layer
 * writes the resolved palette onto <html>), and Tailwind's own runtime does
 * the same. Removing it means moving every dynamic style behind a nonce.
 *
 * 'unsafe-inline' on script-src is required by Next.js 14's App Router, which
 * inlines the flight payload and the bootstrap without a nonce unless you opt
 * into nonce-based CSP. 'unsafe-eval' is dev-only (React Refresh).
 *
 * Neither is a reason to skip the header: frame-ancestors, base-uri,
 * form-action, object-src and the connect/img allowlists all still hold, and
 * they are what stop clickjacking, base-tag injection and exfiltration to an
 * arbitrary host.
 */
const isDev = process.env.NODE_ENV === 'development';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Avatars are stored as data: URLs, Google serves OAuth profile photos, and
  // link previews render remote og:image URLs.
  "img-src 'self' data: blob: https:",
  `connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com${isDev ? ' ws: http://localhost:*' : ''}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const nextConfig = {
  // Do not advertise the framework version to scanners.
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          // Note ids and search terms live in the URL; do not leak them to
          // third-party origins on outbound navigation.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=()',
          },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
      {
        // Authenticated JSON must never be cached by a shared proxy.
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
