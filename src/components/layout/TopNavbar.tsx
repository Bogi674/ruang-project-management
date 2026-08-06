'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from './Logo';
import { AutosaveIndicator } from './AutosaveIndicator';
import { NotificationBell } from './NotificationBell';
import { UserAvatar } from './UserAvatar';
import { AutosaveState } from '@/types';

const NAV_TABS = [
  { label: 'Home', href: '/home' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'My Room', href: '/room' },
  { label: 'Search', href: '/search' },
];

interface TopNavbarProps {
  autosaveState?: AutosaveState;
  userName?: string;
  userImage?: string | null;
}

export function TopNavbar({ autosaveState, userName = '', userImage }: TopNavbarProps) {
  const pathname = usePathname();
  const isNoteEditor = pathname?.startsWith('/note');

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-[52px] bg-bg-base border-b border-border-default flex items-center px-5 gap-6">
      <Logo size="md" />

      <nav className="flex items-center gap-1 ml-2">
        {NAV_TABS.map((tab) => {
          const active = pathname === tab.href || (tab.href !== '/home' && pathname?.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`px-3 py-1.5 text-13 rounded-md transition-colors duration-120 no-underline ${
                active
                  ? 'text-text-primary font-semibold border-b-[2.5px] border-accent-blue rounded-none pb-[4px]'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
              style={{ fontWeight: active ? 580 : 400 }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        {isNoteEditor && autosaveState && <AutosaveIndicator state={autosaveState} />}
        <NotificationBell />
        <UserAvatar name={userName} image={userImage} />
      </div>
    </header>
  );
}
