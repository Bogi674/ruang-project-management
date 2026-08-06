'use client';

import Link from 'next/link';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 20 : size === 'lg' ? 28 : 22;
  return (
    <Link href="/home" className="flex items-center gap-2 no-underline">
      <svg width={dims} height={dims} viewBox="0 0 32 32" fill="none">
        <polygon
          points="16,3 29,27 3,27"
          fill="rgba(115,130,144,0.18)"
          stroke="#738290"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line x1="16" y1="3" x2="16" y2="27" stroke="#738290" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="9.5" y1="18" x2="22.5" y2="18" stroke="#738290" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      <span
        className="font-serif text-text-primary tracking-widest select-none"
        style={{ fontSize: size === 'sm' ? 15 : size === 'lg' ? 20 : 17, letterSpacing: '0.08em' }}
      >
        ruang
      </span>
    </Link>
  );
}
