'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Space } from '@/types';
import { SpaceModal } from '@/components/spaces/SpaceModal';

const PINNED_KEY = 'ruang_pinned_spaces';

function getPinnedIds(): string[] {
  try { return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]'); } catch { return []; }
}
function setPinnedIds(ids: string[]) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
}

interface SpaceItemProps {
  space: Space;
  level?: number;
  pinnedIds: string[];
  onNewChild: (id: string, name: string) => void;
  onRefresh: () => void;
  onPinToggle: (id: string) => void;
  onDelete: (id: string, name: string) => void;
}

function SpaceItem({ space, level = 0, pinnedIds, onNewChild, onRefresh, onPinToggle, onDelete }: SpaceItemProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasChildren = space.children && space.children.length > 0;
  const dotSize = level === 0 ? 7 : level === 1 ? 6 : 5;
  const canAddChild = (space.depth ?? 0) < 2;
  const isPinned = pinnedIds.includes(space.id);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

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
          {isPinned && (
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 text-accent-blue ml-auto opacity-70">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
          )}
        </Link>

        {/* Hover actions */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
          {canAddChild && (
            <button
              onClick={() => onNewChild(space.id, space.name)}
              className="w-5 h-5 flex items-center justify-center text-text-faint hover:text-text-secondary"
              title="New sub-space"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
              </svg>
            </button>
          )}
          {/* Space menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-5 h-5 flex items-center justify-center text-text-faint hover:text-text-secondary"
              title="Space options"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
            {menuOpen && (
              <div
                className="absolute left-full top-0 ml-1 w-40 bg-bg-base border border-border-default rounded-[10px] py-1 z-50"
                style={{ boxShadow: '0 8px 24px rgba(44,56,72,.12)' }}
              >
                <button
                  onClick={() => { onPinToggle(space.id); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-bg-surface transition-colors flex items-center gap-2"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
                  </svg>
                  {isPinned ? 'Unpin from top' : 'Pin to top'}
                </button>
                <div className="h-px bg-border-light mx-2 my-1" />
                <button
                  onClick={() => { onDelete(space.id, space.name); setMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 text-[12px] text-danger hover:bg-danger-bg transition-colors flex items-center gap-2"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                  Delete space
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {open && hasChildren && (
        <ul className="ml-4 mt-0.5 space-y-0.5">
          {space.children!.map((child) => (
            <SpaceItem
              key={child.id}
              space={child}
              level={level + 1}
              pinnedIds={pinnedIds}
              onNewChild={onNewChild}
              onRefresh={onRefresh}
              onPinToggle={onPinToggle}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface DeleteConfirm {
  id: string;
  name: string;
  noteCount: number;
  childCount: number;
}

export function Sidebar() {
  const pathname = usePathname();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [storeroomCount, setStoreroomCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalParent, setModalParent] = useState<{ id: string; name: string } | null>(null);
  const [pinnedIds, setPinnedIdsState] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshSpaces = () => {
    fetch('/api/spaces').then((r) => r.json()).then((d) => setSpaces(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(() => {
    setPinnedIdsState(getPinnedIds());
    refreshSpaces();
    fetch('/api/notes?storeroom=true&count=true')
      .then((r) => r.json())
      .then((d) => setStoreroomCount(d?.count || 0))
      .catch(() => {});
  }, []);

  // Only refresh storeroom count on navigation
  useEffect(() => {
    fetch('/api/notes?storeroom=true&count=true')
      .then((r) => r.json())
      .then((d) => setStoreroomCount(d?.count || 0))
      .catch(() => {});
  }, [pathname]);

  function openNewSpace() { setModalParent(null); setShowModal(true); }
  function openNewChild(id: string, name: string) { setModalParent({ id, name }); setShowModal(true); }

  function handlePinToggle(id: string) {
    const current = getPinnedIds();
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    setPinnedIds(next);
    setPinnedIdsState(next);
  }

  async function handleDeleteRequest(id: string, name: string) {
    const res = await fetch(`/api/spaces/${id}?check=true`, { method: 'DELETE' });
    if (!res.ok) return;
    const { noteCount, childCount } = await res.json();
    if (noteCount === 0 && childCount === 0) {
      // Empty space — delete immediately
      await fetch(`/api/spaces/${id}`, { method: 'DELETE' });
      refreshSpaces();
    } else {
      setDeleteConfirm({ id, name, noteCount, childCount });
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    setDeleting(true);
    await fetch(`/api/spaces/${deleteConfirm.id}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    setDeleting(false);
    refreshSpaces();
  }

  // Sort pinned spaces to top
  const sortedSpaces = [...spaces].sort((a, b) => {
    const aPin = pinnedIds.includes(a.id) ? 0 : 1;
    const bPin = pinnedIds.includes(b.id) ? 0 : 1;
    return aPin - bPin;
  });

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
            {sortedSpaces.length === 0 && (
              <p className="text-[11px] text-text-faint px-2">No spaces yet.</p>
            )}
            <ul className="space-y-0.5">
              {sortedSpaces.map((space) => (
                <SpaceItem
                  key={space.id}
                  space={space}
                  pinnedIds={pinnedIds}
                  onNewChild={openNewChild}
                  onRefresh={refreshSpaces}
                  onPinToggle={handlePinToggle}
                  onDelete={handleDeleteRequest}
                />
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

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-bg-base rounded-[14px] p-6 w-[360px] shadow-modal">
            <h3 className="font-serif text-[17px] text-text-primary mb-2" style={{ letterSpacing: '-0.01em' }}>
              Delete &ldquo;{deleteConfirm.name}&rdquo;?
            </h3>
            <p className="text-[13px] text-text-secondary mb-1">
              This space contains:
            </p>
            <ul className="text-[13px] text-text-secondary mb-4 list-disc list-inside space-y-0.5">
              {deleteConfirm.noteCount > 0 && (
                <li>{deleteConfirm.noteCount} note{deleteConfirm.noteCount !== 1 ? 's' : ''} → will be moved to My Storeroom</li>
              )}
              {deleteConfirm.childCount > 0 && (
                <li>{deleteConfirm.childCount} sub-space{deleteConfirm.childCount !== 1 ? 's' : ''} → will be deleted</li>
              )}
            </ul>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-[13px] text-text-secondary hover:bg-bg-surface rounded-[8px] transition-colors"
              >Cancel</button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 text-[13px] font-medium text-white bg-danger hover:bg-danger-dark rounded-[8px] transition-colors"
              >{deleting ? 'Deleting…' : 'Delete space'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
