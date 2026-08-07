'use client';

import Link from 'next/link';

interface LogoProps {
  variant?: 'text' | 'mark';
  href?: string;
  className?: string;
  height?: number;
}

export function Logo({ variant = 'text', href = '/home', className = '', height = 28 }: LogoProps) {
  const src = variant === 'text' ? '/logo/ruang_logo_text.png' : '/logo/ruang_logo.png';
  return (
    <Link href={href} className={`flex items-center no-underline ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Ruang" style={{ height, width: 'auto', display: 'block' }} />
    </Link>
  );
}
