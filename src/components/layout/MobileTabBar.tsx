'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    label: 'Home',
    href: '/home',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    label: 'Calendar',
    href: '/calendar',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    label: 'My Room',
    href: '/room',
    // Desk lamp — deliberately distinct from the Home house icon.
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 2h6l3 7H6l3-7z"/><path d="M12 9v9"/><path d="M8 21h8"/><path d="M12 18a3 3 0 0 0-3 3"/><path d="M12 18a3 3 0 0 1 3 3"/>
      </svg>
    ),
  },
  {
    label: 'Search',
    href: '/search',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
];

export function MobileTabBar() {
  const pathname = usePathname();

  return (
    // The 64px bar height is on top of the safe-area inset rather than inside
    // it — otherwise the inset padding squeezes the icons over the top border.
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-bg-base border-t border-border-default flex"
      style={{ height: 'calc(64px + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || (tab.href !== '/home' && pathname?.startsWith(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 no-underline transition-colors duration-120 ${
              active ? 'text-accent-blue-dark' : 'text-text-muted'
            }`}
          >
            {tab.icon}
            <span className="text-[10px] leading-none">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
