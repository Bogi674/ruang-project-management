'use client';

import Link from 'next/link';

interface LogoProps {
  variant?: 'text' | 'mark';
  href?: string;
  className?: string;
  height?: number;
}

/**
 * The logo artwork is a PNG with baked-in ink, so dark mode needs the reversed
 * file rather than a filter.
 *
 * Both files are rendered and one is hidden by a `[data-theme]` rule in
 * globals.css, instead of picking the source in JS. Choosing in JS would mean
 * reading the theme on the client, which is a render behind the server — the
 * dark logo would flash light on every load. A CSS swap resolves with the
 * document, and the hidden image costs one cached request.
 */
export function Logo({ variant = 'text', href = '/home', className = '', height = 28 }: LogoProps) {
  const base = variant === 'text' ? '/logo/ruang_logo_text' : '/logo/ruang_logo';
  const style = { height, width: 'auto' };
  return (
    <Link href={href} className={`flex items-center no-underline ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}.png`} alt="Ruang" className="logo-light" style={style} />
      {/* Empty alt: the light copy above already names it, so a screen reader
          would otherwise announce the wordmark twice. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}_reversed.png`} alt="" aria-hidden="true" className="logo-dark" style={style} />
    </Link>
  );
}
