'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Space } from '@/types';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
}

export function MobileDrawer({ open, onClose, userName = '', userEmail = '' }: MobileDrawerProps) {
  const pathname = usePathname();
  const [spaces, setSpaces] = useState<Space[]>([]);

  useEffect(() => {
    if (open) {
      fetch('/api/spaces').then((r) => r.json()).then((d) => setSpaces(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [open]);

  useEffect(() => { onClose(); }, [pathname]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 animate-fadeIn" onClick={onClose} />
      <div className="fixed top-0 left-0 bottom-0 w-[280px] z-50 bg-bg-base flex flex-col animate-slideLeft shadow-modal">
        <div className="flex items-center justify-between p-4 border-b border-border-default">
          <span className="font-serif text-[17px] text-text-primary" style={{ letterSpacing: '-0.02em' }}>ruang</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-text-muted">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div>
            <Link href="/storeroom" className="flex items-center gap-3 py-2 text-14 text-text-secondary no-underline hover:text-text-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4h14a1 1 0 0 1 1 1v4H4V5a1 1 0 0 1 1-1z"/><path d="M4 9h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9z"/>
              </svg>
              My Storeroom
            </Link>
          </div>

          <div>
            <p className="text-[9.5px] font-mono uppercase tracking-[0.1em] text-text-faint mb-2">Spaces</p>
            {spaces.map((s) => (
              <Link key={s.id} href={`/space/${s.id}`} className="flex items-center gap-3 py-2 text-14 text-text-secondary no-underline hover:text-text-primary">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color }} />
                {s.icon && `${s.icon} `}{s.name}
              </Link>
            ))}
          </div>

          <div>
            <Link href="/settings" className="flex items-center gap-3 py-2 text-14 text-text-secondary no-underline hover:text-text-primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </Link>
          </div>
        </div>

        <div className="border-t border-border-default p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-slate flex items-center justify-center text-white text-11 font-semibold flex-shrink-0">
              {userName?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-13 font-semibold text-text-primary truncate">{userName}</p>
              <p className="text-11 text-text-muted truncate">{userEmail}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
