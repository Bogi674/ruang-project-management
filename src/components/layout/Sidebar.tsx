'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Space } from '@/types';
import { SpaceModal } from '@/components/spaces/SpaceModal';

function SpaceItem({ space, level = 0, onNewChild, onRefresh }: {
  space: Space;
  level?: number;
  onNewChild: (id: string, name: string) => void;
  onRefresh: () => void;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hasChildren = space.children && space.children.length > 0;
  const dotSize = level === 0 ? 7 : level === 1 ? 6 : 5;
  const canAddChild = (space.depth ?? 0) < 2;

  return (
    <li>
      <div className="flex items-center gap-1 group">
        {hasChildren ? (
          <button
            onClick={() => setOpen(!open)}
            className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-secondary flex-shrink-0"
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ transform: open ? 'rotate(90deg)' : '', transition: 'transform 0.12s' }}>
              <path d="M2 1l4 3-4 3V1z" />
            </svg>
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        <Link
          href={`/space/${space.id}`}
          className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] no-underline transition-colors duration-120 ${
            pathname === `/space/${space.id}`
              ? 'bg-accent-blue-bg text-accent-blue-dark'
              : 'text-text-secondary hover:bg-border-light hover:text-text-primary'
          }`}
          style={{ fontWeight: pathname === `/space/${space.id}` ? 580 : 400 }}
        >
          <span className="rounded-full flex-shrink-0" style={{ width: dotSize, height: dotSize, background: space.color || '#738290' }} />
          <span className="truncate">{space.icon && `${space.icon} `}{space.name}</span>
        </Link>
        {canAddChild && (
          <button
            onClick={() => onNewChild(space.id, space.name)}
            className="w-5 h-5 flex items-center justify-center text-text-faint hover:text-text-secondary opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
            title="New sub-space"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
            </svg>
          </button>
        )}
      </div>
      {open && hasChildren && (
        <ul className="ml-4 mt-0.5 space-y-0.5">
          {space.children!.map((child) => (
            <SpaceItem key={child.id} space={child} level={level + 1} onNewChild={onNewChild} onRefresh={onRefresh} />
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
  const [showModal, setShowModal] = useState(false);
  const [modalParent, setModalParent] = useState<{ id: string; name: string } | null>(null);

  const refreshSpaces = () => {
    fetch('/api/spaces').then((r) => r.json()).then((d) => setSpaces(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(() => {
    refreshSpaces();
    fetch('/api/notes?storeroom=true&count=true').then((r) => r.json()).then((d) => setStoreroomCount(d?.count || 0)).catch(() => {});
  }, [pathname]);

  function openNewSpace() {
    setModalParent(null);
    setShowModal(true);
  }

  function openNewChild(id: string, name: string) {
    setModalParent({ id, name });
    setShowModal(true);
  }

  return (
    <>
      <aside className="fixed top-[52px] left-0 w-[208px] h-[calc(100vh-52px)] bg-bg-subtle border-r border-border-default flex flex-col overflow-hidden z-30">
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {/* Storeroom */}
          <div>
            <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint px-2 mb-1.5">Pinned</p>
            <Link
              href="/storeroom"
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] no-underline transition-colors duration-120 ${
                pathname === '/storeroom'
                  ? 'bg-accent-blue-bg text-accent-blue-dark'
                  : 'text-text-secondary hover:bg-border-light hover:text-text-primary'
              }`}
              style={{ fontWeight: pathname === '/storeroom' ? 580 : 400 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><line x1="10" y1="14" x2="14" y2="14"/>
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
                onClick={openNewSpace}
                className="w-5 h-5 flex items-center justify-center text-text-muted hover:text-text-secondary rounded transition-colors"
                title="New space"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
                </svg>
              </button>
            </div>
            {spaces.length === 0 && (
              <p className="text-[11px] text-text-faint px-2">No spaces yet.</p>
            )}
            <ul className="space-y-0.5">
              {spaces.map((space) => (
                <SpaceItem key={space.id} space={space} onNewChild={openNewChild} onRefresh={refreshSpaces} />
              ))}
            </ul>
          </div>
        </div>

        {/* Settings */}
        <div className="border-t border-border-default p-3">
          <Link
            href="/settings"
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] no-underline transition-colors duration-120 ${
              pathname?.startsWith('/settings')
                ? 'bg-accent-blue-bg text-accent-blue-dark'
                : 'text-text-secondary hover:bg-border-light hover:text-text-primary'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Settings
          </Link>
        </div>
      </aside>

      {showModal && (
        <SpaceModal
          onClose={() => setShowModal(false)}
          onCreated={refreshSpaces}
          parentId={modalParent?.id || null}
          parentName={modalParent?.name || null}
        />
      )}
    </>
  );
}
