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
  focusMode?: boolean;
  onToggleFocusMode?: () => void;
  onShowShortcuts?: () => void;
}

export function TopNavbar({ autosaveState, userName = '', userImage, focusMode, onToggleFocusMode, onShowShortcuts }: TopNavbarProps) {
  const pathname = usePathname();
  const isNoteEditor = pathname?.startsWith('/note');

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-[52px] bg-bg-base border-b border-border-default flex items-center px-5 gap-6">
      <Logo size="sm" />

      {!focusMode && (
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
      )}

      <div className="ml-auto flex items-center gap-2">
        {isNoteEditor && autosaveState && <AutosaveIndicator state={autosaveState} />}
        {onShowShortcuts && (
          <button
            onClick={onShowShortcuts}
            title="Keyboard shortcuts (?)"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="3"/>
              <path d="M6 9h1M10 9h1M14 9h1M18 9h1M6 13h1M10 13h1M14 13h1M8 17h8"/>
            </svg>
          </button>
        )}
        {onToggleFocusMode && (
          <button
            onClick={onToggleFocusMode}
            title={focusMode ? 'Exit focus mode (F)' : 'Focus mode (F)'}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
          >
            {focusMode ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3"/>
              </svg>
            )}
          </button>
        )}
        <NotificationBell />
        <UserAvatar name={userName} image={userImage} />
      </div>
    </header>
  );
}
