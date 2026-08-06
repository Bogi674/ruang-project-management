'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Space } from '@/types';

function SpaceItem({ space, level = 0 }: { space: Space; level?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hasChildren = space.children && space.children.length > 0;
  const dotSize = level === 0 ? 7 : level === 1 ? 6 : 5;

  return (
    <li>
      <div className="flex items-center gap-1 group">
        {hasChildren && (
          <button
            onClick={() => setOpen(!open)}
            className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-secondary flex-shrink-0"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ transform: open ? 'rotate(90deg)' : '', transition: 'transform 0.12s' }}>
              <path d="M2 1l4 3-4 3V1z" />
            </svg>
          </button>
        )}
        {!hasChildren && <span className="w-4 flex-shrink-0" />}
        <Link
          href={`/space/${space.id}`}
          className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-13 no-underline transition-colors duration-120 ${
            pathname === `/space/${space.id}`
              ? 'bg-accent-blue-bg text-accent-blue-dark'
              : 'text-text-secondary hover:bg-border-light hover:text-text-primary'
          }`}
          style={{ fontWeight: pathname === `/space/${space.id}` ? 580 : 400 }}
        >
          <span
            className="rounded-full flex-shrink-0"
            style={{ width: dotSize, height: dotSize, background: space.color || '#738290' }}
          />
          <span className="truncate">{space.icon && `${space.icon} `}{space.name}</span>
        </Link>
      </div>
      {open && hasChildren && (
        <ul className="ml-4 mt-0.5 space-y-0.5">
          {space.children!.map((child) => (
            <SpaceItem key={child.id} space={child} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [storeroomCount, setStoreroomCount] = useState(0);

  useEffect(() => {
    fetch('/api/spaces').then((r) => r.json()).then((d) => setSpaces(Array.isArray(d) ? d : [])).catch(() => {});
    fetch('/api/notes?storeroom=true&count=true').then((r) => r.json()).then((d) => setStoreroomCount(d?.count || 0)).catch(() => {});
  }, [pathname]);

  return (
    <aside className="fixed top-[52px] left-0 w-[208px] h-[calc(100vh-52px)] bg-bg-subtle border-r border-border-default flex flex-col overflow-hidden z-30">
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {/* Storeroom */}
        <div>
          <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint px-2 mb-1.5">Pinned</p>
          <Link
            href="/storeroom"
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-13 no-underline transition-colors duration-120 ${
              pathname === '/storeroom'
                ? 'bg-accent-blue-bg text-accent-blue-dark'
                : 'text-text-secondary hover:bg-border-light hover:text-text-primary'
            }`}
            style={{ fontWeight: pathname === '/storeroom' ? 580 : 400 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h14a1 1 0 0 1 1 1v4H4V5a1 1 0 0 1 1-1z"/><path d="M4 9h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9z"/><path d="M10 13h4"/>
            </svg>
            <span className="flex-1">My Storeroom</span>
            {storeroomCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-accent-green text-accent-green-dark rounded-full">
                {storeroomCount}
              </span>
            )}
          </Link>
        </div>

        {/* Spaces */}
        <div>
          <div className="flex items-center px-2 mb-1.5">
            <p className="flex-1 text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint">Spaces</p>
            <button
              onClick={async () => {
                const name = prompt('Space name:');
                if (!name) return;
                await fetch('/api/spaces', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color: '#738290' }) });
                fetch('/api/spaces').then((r) => r.json()).then((d) => setSpaces(Array.isArray(d) ? d : [])).catch(() => {});
              }}
              className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-secondary"
              title="New space"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
              </svg>
            </button>
          </div>
          {spaces.length === 0 && (
            <p className="text-11 text-text-faint px-2">No spaces yet.</p>
          )}
          <ul className="space-y-0.5">
            {spaces.map((space) => (
              <SpaceItem key={space.id} space={space} />
            ))}
          </ul>
        </div>
      </div>

      {/* Settings */}
      <div className="border-t border-border-default p-3">
        <Link
          href="/settings"
          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-13 no-underline transition-colors duration-120 ${
            pathname === '/settings'
              ? 'bg-accent-blue-bg text-accent-blue-dark'
              : 'text-text-secondary hover:bg-border-light hover:text-text-primary'
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Settings
        </Link>
      </div>
    </aside>
  );
}
