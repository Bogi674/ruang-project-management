'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  label: string;
  href: string;
  /** Outline for rest, solid for active — the two states must read apart at a glance. */
  icon: (active: boolean) => React.ReactNode;
}

const SIZE = 20;

const TABS: Tab[] = [
  {
    label: 'Home',
    href: '/home',
    icon: (active) =>
      active ? (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.03 2.32a1.5 1.5 0 0 1 1.94 0l8.5 7.2c.34.29.53.71.53 1.15V20a2 2 0 0 1-2 2h-4.5v-6.5a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1V22H4a2 2 0 0 1-2-2v-9.33c0-.44.19-.86.53-1.15z" />
        </svg>
      ) : (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
  },
  {
    label: 'Calendar',
    href: '/calendar',
    icon: (active) =>
      active ? (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 2a1 1 0 0 1 1 1v1h6V3a1 1 0 1 1 2 0v1h1a3 3 0 0 1 3 3v1H3V7a3 3 0 0 1 3-3h1V3a1 1 0 0 1 1-1z" />
          <path d="M3 10h18v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" opacity=".38" />
        </svg>
      ) : (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
  },
  {
    label: 'My Room',
    href: '/room',
    // Desk lamp — deliberately distinct from the Home house icon.
    icon: (active) =>
      active ? (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 2h6l3 7H6l3-7z" fill="currentColor" />
          <path d="M12 9v9" />
          <path d="M8 21h8" />
          <path d="M12 18a3 3 0 0 0-3 3" />
          <path d="M12 18a3 3 0 0 1 3 3" />
        </svg>
      ) : (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 2h6l3 7H6l3-7z" />
          <path d="M12 9v9" />
          <path d="M8 21h8" />
          <path d="M12 18a3 3 0 0 0-3 3" />
          <path d="M12 18a3 3 0 0 1 3 3" />
        </svg>
      ),
  },
  {
    label: 'Search',
    href: '/search',
    icon: (active) =>
      active ? (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7.5" fill="currentColor" fillOpacity="0.3" />
          <line x1="21" y1="21" x2="16.8" y2="16.8" />
        </svg>
      ) : (
        <svg width={SIZE} height={SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
  },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    // Height and safe-area padding both come from --tabbar-total so the FAB and
    // the page's bottom padding stay in lockstep with the bar.
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-bg-base border-t border-border-default flex"
      style={{ height: 'var(--tabbar-total)', paddingBottom: 'var(--safe-bottom)' }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || (tab.href !== '/home' && pathname?.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            // The stack is centred in the 49px bar with no vertical padding of
            // its own — padding here is what made the bar read as tall.
            className={`flex-1 flex flex-col items-center justify-center gap-[2px] no-underline transition-colors duration-120 ${
              active ? 'text-accent-blue-dark' : 'text-text-muted'
            }`}
          >
            {tab.icon(!!active)}
            <span className="text-[9.5px] leading-none" style={{ fontWeight: active ? 600 : 400 }}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
