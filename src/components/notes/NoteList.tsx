'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Note, Space } from '@/types';
import { NoteRow } from './NoteRow';

interface NoteListProps {
  notes: Note[];
  emptyMessage?: string;
  showAssign?: boolean;
}

export function NoteList({ notes, emptyMessage = "Your Ruang is ready. Tap + to write something.", showAssign }: NoteListProps) {
  const router = useRouter();
  const [items, setItems] = useState<Note[]>(notes);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    fetch('/api/spaces').then(r => r.json()).then(d => setSpaces(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map(n => n.id)));
    }
  }

  function handleNoteDeleted(id: string) {
    setItems(prev => prev.filter(n => n.id !== id));
    setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
  }

  async function handleBulkDelete() {
    if (!confirmBulkDelete) { setConfirmBulkDelete(true); return; }
    setBulkDeleting(true);
    await Promise.all(Array.from(selected).map(id => fetch(`/api/notes/${id}`, { method: 'DELETE' })));
    setItems(prev => prev.filter(n => !selected.has(n.id)));
    setSelected(new Set());
    setConfirmBulkDelete(false);
    setBulkDeleting(false);
    router.refresh();
  }

  async function handleBulkAssign(spaceId: string | null) {
    await Promise.all(Array.from(selected).map(id =>
      fetch(`/api/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ space_id: spaceId }),
      })
    ));
    setSelected(new Set());
    setShowSpacePicker(false);
    router.refresh();
  }

  if (items.length === 0) {
    return <p className="text-13 text-text-faint p-4">{emptyMessage}</p>;
  }

  const allSelected = selected.size === items.length;
  const someSelected = selected.size > 0 && !allSelected;

  return (
    <div>
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
                  className="absolute right-0 top-full mt-1 w-48 bg-bg-base border border-border-default rounded-[10px] py-1.5 z-30"
                  style={{ boxShadow: '0 8px 32px rgba(44,56,72,.12)' }}
                >
                  <button
                    onClick={() => handleBulkAssign(null)}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-text-muted hover:bg-bg-surface transition-colors"
                  >
                    Storeroom (no space)
                  </button>
                  {spaces.length > 0 && <div className="h-px bg-border-light mx-2 my-1" />}
                  {spaces.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleBulkAssign(s.id)}
                      className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface transition-colors flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.color || '#738290' }} />
                      {s.icon && `${s.icon} `}{s.name}
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
          showAssign={showAssign}
          selected={selected.has(note.id)}
          onToggleSelect={toggleSelect}
          onDelete={handleNoteDeleted}
        />
      ))}

      {showSpacePicker && (
        <div className="fixed inset-0 z-20" onClick={() => setShowSpacePicker(false)} />
      )}
    </div>
  );
}
