'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Space } from '@/types';
import { SpaceModal } from '@/components/spaces/SpaceModal';
import { SpaceNoteList } from '@/components/layout/SpaceNoteList';
import { useSpaces } from '@/lib/spaces';
import {
  isNoteDrag,
  getNoteDragData,
  moveNoteToSpace,
  emitNotesChanged,
  NOTES_CHANGED_EVENT,
} from '@/lib/dnd';

const PINNED_KEY = 'ruang_pinned_spaces';

/**
 * Converts a hex color to rgba() with the given alpha.
 * Used to tint the active space row with its own colour instead of always
 * defaulting to the global accent blue.
 */
function spaceRgba(hex: string, alpha: number): string {
  const clean = (hex || '#738290').replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 115;
  const g = parseInt(clean.slice(2, 4), 16) || 130;
  const b = parseInt(clean.slice(4, 6), 16) || 144;
  return `rgba(${r},${g},${b},${alpha})`;
}

function getPinnedIds(): string[] {
  try { return JSON.parse(localStorage.getItem(PINNED_KEY) || '[]'); } catch { return []; }
}
function setPinnedIds(ids: string[]) {
  localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
}

interface MenuState {
  space: Space;
  top: number;
  left: number;
}

interface SpaceItemProps {
  space: Space;
  level?: number;
  pinnedIds: string[];
  onNewChild: (id: string, name: string) => void;
  onOpenMenu: (space: Space, anchor: HTMLElement) => void;
  onDropNote: (spaceId: string, noteId: string) => void;
}

function SpaceItem({ space, level = 0, pinnedIds, onNewChild, onOpenMenu, onDropNote }: SpaceItemProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const hasChildren = !!space.children && space.children.length > 0;
  const noteCount = space.note_count ?? 0;
  // A space is expandable when it holds anything at all — sub-spaces or notes.
  const hasContents = hasChildren || noteCount > 0;
  const dotSize = level === 0 ? 7 : level === 1 ? 6 : 5;
  const canAddChild = (space.depth ?? 0) < 2;
  const isPinned = pinnedIds.includes(space.id);
  const isActive = pathname === `/space/${space.id}`;

  function handleDragOver(e: React.DragEvent) {
    if (!isNoteDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropActive(true);
    // Auto-expand so the user can drop into a nested space mid-drag.
    if (hasContents && !open) setOpen(true);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDropActive(false);
    const payload = getNoteDragData(e);
    if (payload && payload.fromSpaceId !== space.id) onDropNote(space.id, payload.noteId);
  }

  return (
    <li>
      {/* The highlight lives on the whole row (chevron + label + actions) rather
          than just the link, so an active space reads as a full-width band.
          Active rows use the space's own colour as a faint tint instead of
          the global accent-blue, so each room feels visually distinct. */}
      <div
        className="flex items-center gap-1 pr-1 rounded-lg group transition-colors duration-120"
        style={{
          background: dropActive
            ? 'var(--accent-blue-bg)'
            : isActive
            ? spaceRgba(space.color, 0.13)
            : undefined,
          outline: dropActive ? '1px solid var(--accent-blue)' : undefined,
        }}
        onDragOver={handleDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false);
        }}
        onDrop={handleDrop}
      >
        {hasContents ? (
          <button
            onClick={() => setOpen(!open)}
            className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text-secondary flex-shrink-0"
            aria-label={open ? 'Collapse' : 'Expand'}
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
          className="flex-1 min-w-0 flex items-center gap-2 pr-2 py-2 rounded-lg text-[13px] no-underline transition-colors duration-120"
          style={{
            color: isActive ? space.color || 'var(--accent-blue-dark)' : undefined,
            fontWeight: isActive ? 580 : 400,
          }}
        >
          <span className="rounded-full flex-shrink-0" style={{ width: dotSize, height: dotSize, background: space.color || '#738290' }} />
          <span className="truncate">{space.icon && `${space.icon} `}{space.name}</span>
          {noteCount > 0 && !isPinned && (
            <span className="ml-auto text-[10px] text-text-faint flex-shrink-0 tabular-nums">{noteCount}</span>
          )}
          {isPinned && (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 text-accent-amber ml-auto">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
          )}
        </Link>

        {/* Hover actions */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all flex-shrink-0">
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
          <button
            onClick={(e) => onOpenMenu(space, e.currentTarget)}
            className="w-5 h-5 flex items-center justify-center text-text-faint hover:text-text-secondary"
            title="Space options"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
        </div>
      </div>
      {/* Expanded: sub-spaces first, then this space's own notes. Opening a
          note from here goes straight to it; the space page is unchanged and
          still reachable by clicking the space name. */}
      {open && hasContents && (
        <ul className="ml-4 mt-0.5 space-y-0.5">
          {(space.children || []).map((child) => (
            <SpaceItem
              key={child.id}
              space={child}
              level={level + 1}
              pinnedIds={pinnedIds}
              onNewChild={onNewChild}
              onOpenMenu={onOpenMenu}
              onDropNote={onDropNote}
            />
          ))}
          {noteCount > 0 && <SpaceNoteList spaceId={space.id} />}
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

const MIN_W = 176;
const MAX_W = 420;

interface SidebarProps {
  width: number;
  onWidthChange: (w: number) => void;
}

export function Sidebar({ width, onWidthChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  // Shared across the sidebar, the drawer, note lists and the editor.
  const { spaces, refresh: refreshSpaces } = useSpaces();
  const [storeroomCount, setStoreroomCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [modalParent, setModalParent] = useState<{ id: string; name: string } | null>(null);
  const [editSpace, setEditSpace] = useState<Space | null>(null);
  const [pinnedIds, setPinnedIdsState] = useState<string[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [storeroomDropActive, setStoreroomDropActive] = useState(false);
  const [resizing, setResizing] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    fetch('/api/notes?storeroom=true&count=true')
      .then((r) => r.json())
      .then((d) => setStoreroomCount(d?.count || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPinnedIdsState(getPinnedIds());
  }, []);

  // Space note counts drive the expand chevrons, so they follow the same
  // refresh cadence as the storeroom badge.
  useEffect(() => {
    refreshCount();
    refreshSpaces();
  }, [pathname, refreshCount, refreshSpaces]);

  // Refresh when a note is moved or deleted anywhere in the app.
  useEffect(() => {
    function onChanged() {
      refreshCount();
      refreshSpaces();
    }
    window.addEventListener(NOTES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NOTES_CHANGED_EVENT, onChanged);
  }, [refreshCount, refreshSpaces]);

  // Close the space menu on outside click / escape / scroll.
  useEffect(() => {
    if (!menu) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenu(null); }
    function close() { setMenu(null); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', close);
    };
  }, [menu]);

  // ── Resize handle ──
  useEffect(() => {
    if (!resizing) return;
    function onMove(e: MouseEvent) {
      onWidthChange(Math.min(MAX_W, Math.max(MIN_W, e.clientX)));
    }
    function onUp() { setResizing(false); }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    // Keep the cursor consistent and stop text selection while dragging.
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [resizing, onWidthChange]);

  function openNewSpace() { setEditSpace(null); setModalParent(null); setShowModal(true); }
  function openNewChild(id: string, name: string) { setEditSpace(null); setModalParent({ id, name }); setShowModal(true); }

  function openMenu(space: Space, anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    const MENU_H = 190;
    const top = rect.bottom + MENU_H > window.innerHeight
      ? Math.max(8, rect.top - MENU_H)
      : rect.bottom + 4;
    setMenu({ space, top, left: Math.min(rect.left, window.innerWidth - 180) });
  }

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
      await fetch(`/api/spaces/${id}`, { method: 'DELETE' });
      refreshSpaces();
      if (pathname === `/space/${id}`) router.push('/storeroom');
    } else {
      setDeleteConfirm({ id, name, noteCount, childCount });
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    setDeleting(true);
    await fetch(`/api/spaces/${deleteConfirm.id}`, { method: 'DELETE' });
    const deletedId = deleteConfirm.id;
    setDeleteConfirm(null);
    setDeleting(false);
    refreshSpaces();
    refreshCount();
    if (pathname === `/space/${deletedId}`) router.push('/storeroom');
    else router.refresh();
  }

  async function handleDropNote(spaceId: string | null, noteId: string) {
    const ok = await moveNoteToSpace(noteId, spaceId);
    if (!ok) return;
    refreshCount();
    emitNotesChanged();
    router.refresh();
  }

  const sortedSpaces = [...spaces].sort((a, b) => {
    const aPin = pinnedIds.includes(a.id) ? 0 : 1;
    const bPin = pinnedIds.includes(b.id) ? 0 : 1;
    return aPin - bPin;
  });

  return (
    <>
      {/*
        Sized against the *visible* viewport, not `100vh`.

        `100vh` is the large viewport height: it keeps counting the status-bar
        band and any retractable browser toolbar, so `calc(100vh - 52px)` ran
        the sidebar past the bottom of the screen and took the Settings link
        with it — the row was there, just never on screen. `dvh` plus the
        home-indicator inset keeps the whole column reachable.
      */}
      <aside
        className="fixed left-0 bg-bg-subtle border-r border-border-default flex flex-col z-30"
        style={{
          width,
          top: 'var(--navbar-total)',
          height: 'calc(100dvh - var(--navbar-total))',
          paddingBottom: 'var(--safe-bottom)',
          paddingLeft: 'var(--safe-left)',
        }}
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-none py-4 px-2 space-y-5">
          {/* Storeroom — also a drop target for un-assigning a note */}
          <div>
            <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint px-3 mb-1.5">Pinned</p>
            <Link
              href="/storeroom"
              onDragOver={(e) => {
                if (!isNoteDrag(e)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setStoreroomDropActive(true);
              }}
              onDragLeave={() => setStoreroomDropActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setStoreroomDropActive(false);
                const payload = getNoteDragData(e);
                if (payload && payload.fromSpaceId !== null) handleDropNote(null, payload.noteId);
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] no-underline transition-colors duration-120 ${
                storeroomDropActive
                  ? 'ring-1 ring-accent-blue bg-accent-blue-bg text-accent-blue-dark'
                  : pathname === '/storeroom'
                  ? 'bg-accent-blue-bg text-accent-blue-dark'
                  : 'text-text-secondary hover:bg-border-light hover:text-text-primary'
              }`}
              style={{ fontWeight: pathname === '/storeroom' ? 580 : 400 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><line x1="10" y1="14" x2="14" y2="14"/>
              </svg>
              <span className="flex-1 truncate">My Storeroom</span>
              {storeroomCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-accent-green text-accent-green-dark rounded-full flex-shrink-0">
                  {storeroomCount}
                </span>
              )}
            </Link>
          </div>

          {/* Spaces */}
          <div>
            <div className="flex items-center px-3 mb-1.5">
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
              <p className="text-[11px] text-text-faint px-3">No spaces yet.</p>
            )}
            <ul className="space-y-0.5">
              {sortedSpaces.map((space) => (
                <SpaceItem
                  key={space.id}
                  space={space}
                  pinnedIds={pinnedIds}
                  onNewChild={openNewChild}
                  onOpenMenu={openMenu}
                  onDropNote={(sid, nid) => handleDropNote(sid, nid)}
                />
              ))}
            </ul>
          </div>
        </div>

        {/* Settings */}
        <div className="border-t border-border-default p-2 flex-shrink-0">
          <Link
            href="/settings"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] no-underline transition-colors duration-120 ${
              pathname?.startsWith('/settings')
                ? 'bg-accent-blue-bg text-accent-blue-dark'
                : 'text-text-secondary hover:bg-border-light hover:text-text-primary'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Settings
          </Link>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={(e) => { e.preventDefault(); setResizing(true); }}
          onDoubleClick={() => onWidthChange(280)}
          className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize group ${
            resizing ? 'bg-accent-blue' : 'hover:bg-[var(--accent-wash-strong)]'
          } transition-colors duration-120`}
          title="Drag to resize · double-click to reset"
        />
      </aside>

      {/* Space context menu — portalled so the sidebar cannot clip it */}
      {menu && typeof document !== 'undefined' && createPortal(
        <div
          ref={menuRef}
          className="fixed w-44 bg-bg-base border border-border-default rounded-[10px] py-1 z-[100]"
          style={{ top: menu.top, left: menu.left, boxShadow: 'var(--shadow-modal)' }}
        >
          <button
            onClick={() => { setEditSpace(menu.space); setModalParent(null); setShowModal(true); setMenu(null); }}
            className="w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-bg-surface transition-colors flex items-center gap-2"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit space
          </button>
          {(menu.space.depth ?? 0) < 2 && (
            <button
              onClick={() => { openNewChild(menu.space.id, menu.space.name); setMenu(null); }}
              className="w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-bg-surface transition-colors flex items-center gap-2"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
              </svg>
              New sub-space
            </button>
          )}
          <button
            onClick={() => { handlePinToggle(menu.space.id); setMenu(null); }}
            className="w-full text-left px-3 py-2 text-[12px] text-text-secondary hover:bg-bg-surface transition-colors flex items-center gap-2"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill={pinnedIds.includes(menu.space.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
            {pinnedIds.includes(menu.space.id) ? 'Unpin from top' : 'Pin to top'}
          </button>
          <div className="h-px bg-border-light mx-2 my-1" />
          <button
            onClick={() => { handleDeleteRequest(menu.space.id, menu.space.name); setMenu(null); }}
            className="w-full text-left px-3 py-2 text-[12px] text-danger hover:bg-danger-bg transition-colors flex items-center gap-2"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
            Delete space
          </button>
        </div>,
        document.body
      )}

      {showModal && (
        <SpaceModal
          onClose={() => { setShowModal(false); setEditSpace(null); }}
          onCreated={() => { refreshSpaces(); router.refresh(); }}
          parentId={modalParent?.id || null}
          parentName={modalParent?.name || null}
          editSpace={editSpace}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="absolute inset-0" style={{ background: 'var(--scrim)' }} onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-bg-base rounded-[14px] p-6 w-[360px] shadow-modal">
            <h3 className="font-serif text-[17px] text-text-primary mb-2" style={{ letterSpacing: '-0.01em' }}>
              Delete &ldquo;{deleteConfirm.name}&rdquo;?
            </h3>
            <p className="text-[13px] text-text-secondary mb-1">This space contains:</p>
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
