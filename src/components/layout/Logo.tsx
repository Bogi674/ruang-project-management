'use client';

import Link from 'next/link';

interface LogoProps {
  variant?: 'text' | 'mark';
  href?: string;
  className?: string;
  height?: number;
}

/*
 * The logo art is baked ink-on-transparent, so on the dark canvas it reads as a
 * dark smudge. Both marks ship with a reversed (white) counterpart.
 *
 * Both files are rendered and one is hidden by `[data-theme]` in globals.css
 * rather than picking the src in JS: the theme attribute is written onto <html>
 * by the server (and by the pre-paint script before React runs), so a CSS swap
 * is correct on the very first paint. Choosing in React would mean a light
 * logo flashing on every dark-mode load, and would not match on the server.
 */
export function Logo({ variant = 'text', href = '/home', className = '', height = 28 }: LogoProps) {
  const src = variant === 'text' ? '/logo/ruang_logo_text.png' : '/logo/ruang_logo.png';
  const srcReversed =
    variant === 'text' ? '/logo/ruang_logo_text_reversed.png' : '/logo/ruang_logo_reversed.png';
  const imgStyle = { height, width: 'auto' } as const;
  return (
    <Link href={href} className={`flex items-center no-underline ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Ruang" className="logo-img logo-img-light" style={imgStyle} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {/* Same alt on both: whichever one `display: none` hides is dropped from
          the accessibility tree, so the link is never named twice. */}
      <img src={srcReversed} alt="Ruang" className="logo-img logo-img-dark" style={imgStyle} />
    </Link>
  );
}
