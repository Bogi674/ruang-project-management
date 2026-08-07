'use client';

import { useRouter } from 'next/navigation';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { UserAvatar } from './UserAvatar';

interface MobileHeaderProps {
  inNote?: boolean;
  noteTitle?: string;
  onHamburger: () => void;
  userName?: string;
  userImage?: string | null;
}

export function MobileHeader({ inNote, noteTitle, onHamburger, userName = '', userImage }: MobileHeaderProps) {
  const router = useRouter();

  if (inNote) {
    return (
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-bg-base border-b border-border-default flex items-center px-4 gap-3">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center text-text-secondary">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
        <span className="flex-1 text-13 font-semibold text-text-primary truncate">{noteTitle || 'Note'}</span>
        {/* Note actions live in the editor's own mobile action bar, so there is
            no dead overflow button here. */}
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-bg-base border-b border-border-default flex items-center px-4">
      <button onClick={onHamburger} className="w-8 h-8 flex items-center justify-center text-text-secondary mr-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
        </svg>
      </button>
      <div className="flex-1 flex justify-center">
        <Logo variant="text" height={22} />
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <UserAvatar name={userName} image={userImage} size={28} />
      </div>
    </header>
  );
}
