'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Space } from '@/types';
import { Logo } from './Logo';
import { SpaceModal } from '@/components/spaces/SpaceModal';
import { SpaceNoteList } from './SpaceNoteList';
import { emitNotesChanged } from '@/lib/dnd';
import { useSpaces } from '@/lib/spaces';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
  userEmail?: string;
}

interface DeleteConfirm {
  id: string;
  name: string;
  noteCount: number;
  childCount: number;
}

interface SpaceRowProps {
  space: Space;
  level: number;
  onEdit: (s: Space) => void;
  onAddChild: (s: Space) => void;
  onDelete: (s: Space) => void;
  manageMode: boolean;
  onNavigate: () => void;
}

function SpaceRow({ space, level, onEdit, onAddChild, onDelete, manageMode, onNavigate }: SpaceRowProps) {
  const children = space.children || [];
  const noteCount = space.note_count ?? 0;
  const [showNotes, setShowNotes] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1" style={{ paddingLeft: level * 14 }}>
        {noteCount > 0 && !manageMode ? (
          <button
            onClick={() => setShowNotes((v) => !v)}
            className="w-6 h-8 flex items-center justify-center text-text-muted flex-shrink-0"
            aria-label={showNotes ? `Hide notes in ${space.name}` : `Show notes in ${space.name}`}
            aria-expanded={showNotes}
          >
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ transform: showNotes ? 'rotate(90deg)' : '', transition: 'transform 0.12s' }}>
              <path d="M2 1l4 3-4 3V1z" />
            </svg>
          </button>
        ) : (
          <span className="w-6 flex-shrink-0" />
        )}
        <Link
          href={`/space/${space.id}`}
          onClick={onNavigate}
          className="flex-1 min-w-0 flex items-center gap-3 py-2.5 text-14 text-text-secondary no-underline active:text-text-primary"
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: space.color || '#738290' }}
          />
          <span className="truncate">{space.icon && `${space.icon} `}{space.name}</span>
          {noteCount > 0 && (
            <span className="ml-auto text-[11px] text-text-faint flex-shrink-0 tabular-nums">{noteCount}</span>
          )}
        </Link>
        {manageMode && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {(space.depth ?? 0) < 2 && (
              <button
                onClick={() => onAddChild(space)}
                className="w-8 h-8 flex items-center justify-center text-text-muted rounded-lg active:bg-bg-surface"
                aria-label={`Add sub-space to ${space.name}`}
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
                </svg>
              </button>
            )}
            <button
              onClick={() => onEdit(space)}
              className="w-8 h-8 flex items-center justify-center text-text-muted rounded-lg active:bg-bg-surface"
              aria-label={`Edit ${space.name}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button
              onClick={() => onDelete(space)}
              className="w-8 h-8 flex items-center justify-center text-danger rounded-lg active:bg-danger-bg"
              aria-label={`Delete ${space.name}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      {showNotes && noteCount > 0 && (
        <ul style={{ paddingLeft: level * 14 }}>
          <SpaceNoteList spaceId={space.id} onNavigate={onNavigate} />
        </ul>
      )}
      {children.map((c) => (
        <SpaceRow
          key={c.id}
          space={c}
          level={level + 1}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
          manageMode={manageMode}
          onNavigate={onNavigate}
        />
      ))}
    </>
  );
}

export function MobileDrawer({ open, onClose, userName = '', userEmail = '' }: MobileDrawerProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { spaces, refresh: refreshSpaces } = useSpaces();
  const [manageMode, setManageMode] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalParent, setModalParent] = useState<{ id: string; name: string } | null>(null);
  const [editSpace, setEditSpace] = useState<Space | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) refreshSpaces();
  }, [open, refreshSpaces]);

  // Close the drawer on navigation, but keep it open while a modal is up.
  useEffect(() => {
    if (!showModal && !deleteConfirm) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function openNewSpace() { setEditSpace(null); setModalParent(null); setShowModal(true); }
  function openAddChild(s: Space) { setEditSpace(null); setModalParent({ id: s.id, name: s.name }); setShowModal(true); }
  function openEdit(s: Space) { setEditSpace(s); setModalParent(null); setShowModal(true); }

  async function requestDelete(s: Space) {
    const res = await fetch(`/api/spaces/${s.id}?check=true`, { method: 'DELETE' });
    if (!res.ok) return;
    const { noteCount, childCount } = await res.json();
    if (noteCount === 0 && childCount === 0) {
      await fetch(`/api/spaces/${s.id}`, { method: 'DELETE' });
      refreshSpaces();
      if (pathname === `/space/${s.id}`) router.push('/storeroom');
      else router.refresh();
    } else {
      setDeleteConfirm({ id: s.id, name: s.name, noteCount, childCount });
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setDeleting(true);
    await fetch(`/api/spaces/${deleteConfirm.id}`, { method: 'DELETE' });
    const deletedId = deleteConfirm.id;
    setDeleteConfirm(null);
    setDeleting(false);
    refreshSpaces();
    emitNotesChanged();
    if (pathname === `/space/${deletedId}`) router.push('/storeroom');
    else router.refresh();
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 animate-fadeIn" style={{ background: 'var(--scrim)' }} onClick={onClose} />
      {/* Wider than the old fixed 280px so the space rows and their manage
          actions stop stacking into a tall, narrow column. */}
      <div
        className="fixed top-0 left-0 bottom-0 z-50 bg-bg-base flex flex-col animate-slideLeft shadow-modal"
        style={{ width: 'min(88vw, 330px)' }}
      >
        {/* Header — full logo lockup */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-default flex-shrink-0">
          <Logo variant="text" height={24} />
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-text-muted" aria-label="Close menu">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Scrollable middle */}
        <div className="flex-1 overflow-y-auto overscroll-none px-4 py-4 space-y-5">
          <Link
            href="/storeroom"
            className={`flex items-center gap-3 py-2.5 text-14 no-underline ${
              pathname === '/storeroom' ? 'text-accent-blue-dark font-medium' : 'text-text-secondary'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="5" rx="1"/><path d="M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><line x1="10" y1="14" x2="14" y2="14"/>
            </svg>
            My Storeroom
          </Link>

          <div>
            <div className="flex items-center gap-1 mb-1">
              <p className="flex-1 text-[9.5px] font-mono uppercase tracking-[0.1em] text-text-faint">Spaces</p>
              <button
                onClick={() => setManageMode((v) => !v)}
                className={`text-[10.5px] px-2 py-1 rounded-full border transition-colors ${
                  manageMode
                    ? 'bg-accent-blue text-accent-ink border-accent-blue'
                    : 'border-border-default text-text-muted'
                }`}
              >
                {manageMode ? 'Done' : 'Manage'}
              </button>
              <button
                onClick={openNewSpace}
                className="w-7 h-7 flex items-center justify-center text-text-muted rounded-lg active:bg-bg-surface"
                aria-label="New space"
              >
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
                </svg>
              </button>
            </div>
            {spaces.length === 0 ? (
              <p className="text-[11.5px] text-text-faint py-1">No spaces yet. Tap + to create one.</p>
            ) : (
              spaces.map((s) => (
                <SpaceRow
                  key={s.id}
                  space={s}
                  level={0}
                  onEdit={openEdit}
                  onAddChild={openAddChild}
                  onDelete={requestDelete}
                  manageMode={manageMode}
                  onNavigate={onClose}
                />
              ))
            )}
          </div>
        </div>

        {/* Docked footer: Settings + profile */}
        <div className="flex-shrink-0 border-t border-border-default">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-4 py-3 text-14 no-underline ${
              pathname?.startsWith('/settings') ? 'text-accent-blue-dark font-medium' : 'text-text-secondary'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </Link>

          <div
            className="flex items-center gap-3 px-4 py-3 border-t border-border-light"
            style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
          >
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

      {showModal && (
        <SpaceModal
          onClose={() => { setShowModal(false); setEditSpace(null); }}
          onCreated={() => { refreshSpaces(); router.refresh(); }}
          parentId={modalParent?.id || null}
          parentName={modalParent?.name || null}
          editSpace={editSpace}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'var(--scrim)' }} onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-bg-base rounded-[14px] p-5 w-full max-w-[340px] shadow-modal">
            <h3 className="font-serif text-[17px] text-text-primary mb-2" style={{ letterSpacing: '-0.01em' }}>
              Delete &ldquo;{deleteConfirm.name}&rdquo;?
            </h3>
            <p className="text-[13px] text-text-secondary mb-1">This space contains:</p>
            <ul className="text-[13px] text-text-secondary mb-4 list-disc list-inside space-y-0.5">
              {deleteConfirm.noteCount > 0 && (
                <li>{deleteConfirm.noteCount} note{deleteConfirm.noteCount !== 1 ? 's' : ''} → moved to My Storeroom</li>
              )}
              {deleteConfirm.childCount > 0 && (
                <li>{deleteConfirm.childCount} sub-space{deleteConfirm.childCount !== 1 ? 's' : ''} → deleted</li>
              )}
            </ul>
            <div className="flex items-center gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-[13px] text-text-secondary rounded-[8px]"
              >Cancel</button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 text-[13px] font-medium text-white bg-danger rounded-[8px]"
              >{deleting ? 'Deleting…' : 'Delete space'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
