'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Note } from '@/types';
import { NoteRow } from './NoteRow';
import { flattenSpaces } from '@/components/spaces/SpaceAssignMenu';
import { isNoteDrag, getNoteDragData, moveNoteToSpace, emitNotesChanged } from '@/lib/dnd';
import { useSpaces } from '@/lib/spaces';

interface NoteListProps {
  notes: Note[];
  emptyMessage?: string;
  showAssign?: boolean;
  /**
   * Space this list is scoped to. `null` = My Storeroom, `undefined` = mixed
   * view (Home/Recent) where dropping a note does not imply a destination.
   */
  spaceId?: string | null;
}

export function NoteList({
  notes,
  emptyMessage = 'Your Ruang is ready. Tap + to write something.',
  spaceId,
}: NoteListProps) {
  const router = useRouter();
  const [items, setItems] = useState<Note[]>(notes);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { spaces } = useSpaces();
  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [dropActive, setDropActive] = useState(false);

  // Keep in sync when the server component re-renders with fresh data.
  useEffect(() => { setItems(notes); }, [notes]);

  const isScoped = spaceId !== undefined;

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map(n => n.id)));
  }

  function handleNoteRemoved(id: string) {
    setItems(prev => prev.filter(n => n.id !== id));
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
  }

  async function handleBulkDelete() {
    if (!confirmBulkDelete) { setConfirmBulkDelete(true); return; }
    setBulkDeleting(true);
    const ids = Array.from(selected);
    await Promise.all(ids.map(id => fetch(`/api/notes/${id}`, { method: 'DELETE' })));
    setItems(prev => prev.filter(n => !selected.has(n.id)));
    setSelected(new Set());
    setConfirmBulkDelete(false);
    setBulkDeleting(false);
    emitNotesChanged();
    router.refresh();
  }

  async function handleBulkAssign(targetSpaceId: string | null) {
    const ids = Array.from(selected);
    await Promise.all(ids.map(id => moveNoteToSpace(id, targetSpaceId)));
    if (isScoped && targetSpaceId !== spaceId) {
      setItems(prev => prev.filter(n => !selected.has(n.id)));
    }
    setSelected(new Set());
    setShowSpacePicker(false);
    emitNotesChanged();
    router.refresh();
  }

  // Dropping a note onto a scoped list moves it into that space.
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDropActive(false);
    if (!isScoped) return;
    const payload = getNoteDragData(e);
    if (!payload || payload.fromSpaceId === spaceId) return;
    const ok = await moveNoteToSpace(payload.noteId, spaceId);
    if (!ok) return;
    emitNotesChanged();
    router.refresh();
  }

  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0 && !allSelected;
  const flatSpaces = flattenSpaces(spaces);

  const dropProps = isScoped
    ? {
        onDragOver: (e: React.DragEvent) => {
          if (!isNoteDrag(e)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move' as const;
          setDropActive(true);
        },
        onDragLeave: (e: React.DragEvent) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false);
        },
        onDrop: handleDrop,
      }
    : {};

  if (items.length === 0) {
    return (
      <div
        {...dropProps}
        className={`p-4 transition-colors duration-120 ${
          dropActive ? 'bg-accent-blue-bg' : ''
        }`}
      >
        <p className="text-13 text-text-faint">
          {dropActive ? 'Drop to move here' : emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div
      {...dropProps}
      className={`transition-colors duration-120 ${dropActive ? 'bg-accent-blue-bg' : ''}`}
    >
      {/* Header row: select-all + bulk actions */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-light bg-bg-surface min-h-[36px]">
        <button
          onClick={toggleSelectAll}
          className={`w-3.5 h-3.5 border rounded-[3px] flex-shrink-0 flex items-center justify-center transition-colors ${
            allSelected
              ? 'bg-accent-blue border-accent-blue'
              : someSelected
              ? 'bg-accent-blue-bg border-accent-blue'
              : 'border-border-medium hover:border-accent-blue'
          }`}
          aria-label="Select all notes"
        >
          {(allSelected || someSelected) && (
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {allSelected
                ? <polyline points="1.5,5 4,7.5 8.5,2.5" />
                : <line x1="2" y1="5" x2="8" y2="5" />
              }
            </svg>
          )}
        </button>

        <span className="text-[11px] text-text-faint flex-1 select-none">
          {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
        </span>

        {selected.size > 0 && (
          <div className="flex items-center gap-1.5">
            {/* Move to space */}
            <div className="relative">
              <button
                onClick={() => { setShowSpacePicker(v => !v); setConfirmBulkDelete(false); }}
                className="h-6 px-2.5 text-[11px] text-text-secondary border border-border-default rounded-full hover:bg-bg-surface transition-colors"
              >
                Move to space
              </button>
              {showSpacePicker && (
                <div
                  className="absolute right-0 top-full mt-1 w-48 max-h-[280px] overflow-y-auto bg-bg-base border border-border-default rounded-[10px] py-1.5 z-30"
                  style={{ boxShadow: '0 8px 32px rgba(44,56,72,.12)' }}
                >
                  <button
                    onClick={() => handleBulkAssign(null)}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-text-muted hover:bg-bg-surface transition-colors"
                  >
                    My Storeroom
                  </button>
                  {flatSpaces.length > 0 && <div className="h-px bg-border-light mx-2 my-1" />}
                  {flatSpaces.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleBulkAssign(s.id)}
                      className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface transition-colors flex items-center gap-2"
                      style={{ paddingLeft: 12 + s._level * 12 }}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color || '#738290' }} />
                      <span className="truncate">{s.icon && `${s.icon} `}{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bulk delete */}
            {confirmBulkDelete ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="h-6 px-2 text-[11px] font-medium text-white bg-danger rounded-md transition-colors"
                >
                  {bulkDeleting ? '…' : `Delete ${selected.size}`}
                </button>
                <button
                  onClick={() => setConfirmBulkDelete(false)}
                  className="h-6 px-2 text-[11px] text-text-muted hover:text-text-secondary rounded-md"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={handleBulkDelete}
                className="h-6 px-2.5 text-[11px] text-danger border border-danger-border rounded-full hover:bg-danger-bg transition-colors"
              >
                Delete {selected.size}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Note rows */}
      {items.map(note => (
        <NoteRow
          key={note.id}
          note={note}
          spaceId={spaceId}
          selected={selected.has(note.id)}
          onToggleSelect={toggleSelect}
          onDelete={handleNoteRemoved}
          onMoved={handleNoteRemoved}
        />
      ))}

      {showSpacePicker && (
        <div className="fixed inset-0 z-20" onClick={() => setShowSpacePicker(false)} />
      )}
    </div>
  );
}
