'use client';

import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  markOnly?: boolean;
  href?: string;
  className?: string;
}

export function RuangMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'sm' ? 22 : size === 'lg' ? 36 : 28;
  return (
    <svg
      width={dims}
      height={Math.round(dims * 1.12)}
      viewBox="0 0 100 112"
      fill="none"
      aria-label="Ruang mark"
    >
      <polygon
        points="46,6 50,73 5,106"
        fill="var(--logo-fill)"
      />
      <line x1="50" y1="6" x2="50" y2="73" stroke="var(--logo-stroke)" strokeWidth="7" strokeLinecap="round" />
      <line x1="50" y1="73" x2="5" y2="106" stroke="var(--logo-stroke)" strokeWidth="7" strokeLinecap="round" />
      <line x1="50" y1="73" x2="95" y2="106" stroke="var(--logo-stroke)" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

export function RuangLockup({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const markDims = size === 'sm' ? 22 : size === 'lg' ? 36 : 28;
  const textSize = size === 'sm' ? 18 : size === 'lg' ? 28 : 22;
  return (
    <div className="flex items-center gap-3">
      <RuangMark size={size} />
      <span
        className="font-serif select-none leading-none"
        style={{
          fontSize: textSize,
          color: 'var(--logo-text)',
          letterSpacing: '-0.02em',
          fontWeight: 400,
        }}
      >
        ruang
      </span>
    </div>
  );
}

export function Logo({ size = 'md', markOnly = false, href = '/home', className = '' }: LogoProps) {
  return (
    <Link href={href} className={`flex items-center no-underline ${className}`}>
      {markOnly ? <RuangMark size={size} /> : <RuangLockup size={size} />}
    </Link>
  );
}
