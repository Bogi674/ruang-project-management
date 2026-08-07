'use client';

import Image from 'next/image';
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
      <Image
        src={src}
        alt="Ruang"
        height={height}
        width={0}
        style={{ width: 'auto', height }}
        priority
      />
    </Link>
  );
}
