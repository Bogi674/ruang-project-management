'use client';

import Image from 'next/image';
import Link from 'next/link';

interface LogoProps {
  href?: string;
  className?: string;
  height?: number;
}

export function Logo({ href = '/home', className = '', height = 28 }: LogoProps) {
  return (
    <Link href={href} className={`flex items-center no-underline ${className}`}>
      <Image
        src="/logo.png"
        alt="Ruang"
        height={height}
        width={0}
        style={{ width: 'auto', height }}
        priority
      />
    </Link>
  );
}
