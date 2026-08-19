'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Note, Todo } from '@/types';
import { AnchoredPanel, PanelLabel } from '../AnchoredPanel';
import { NoteIcon, SearchIcon } from '../icons';
import { useTodoActions } from '../TodoProvider';

/**
 * Attach popover.
 *
 * Three routes to the same place: link a note that already exists, upload a
 * file, or start a new note already linked to this to-do. The third is the one
 * that matters most — "I need to write something about this" is the commonest
 * reason a to-do stalls, and making that one click keeps the thought attached
 * to the task instead of stranded in the storeroom.
 */
export function AttachPopover({
  anchorRef,
  onClose,
  todo,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  todo: Todo;
}) {
  const { attach } = useTodoActions();
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/notes')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Note[]) => {
        if (!cancelled) setNotes(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        /* the dropzone and "new note" still work without the recent list */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const attachedNoteIds = useMemo(
    () => new Set((todo.attachments || []).filter((a) => a.note_id).map((a) => a.note_id)),
    [todo.attachments]
  );

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return notes
      .filter((note) => !attachedNoteIds.has(note.id))
      .filter((note) => !term || (note.title || '').toLowerCase().includes(term))
      .slice(0, 6);
  }, [attachedNoteIds, notes, query]);

  async function linkNote(noteId: string) {
    setBusy(true);
    await attach(todo.id, { kind: 'note', note_id: noteId });
    setBusy(false);
    onClose();
  }

  /**
   * Creates the note first, then links it, then navigates.
   *
   * Creation is in this click handler and never in an effect — the pattern
   * FAB.tsx established, because React Strict Mode runs effects twice in
   * development and would leave a duplicate note behind every time.
   */
  async function createLinkedNote() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ space_id: todo.space_id }),
      });
      if (!res.ok) throw new Error();
      const note = (await res.json()) as Note;
      await attach(todo.id, { kind: 'note', note_id: note.id });
      router.push(`/note/${note.id}`);
    } catch {
      setBusy(false);
    }
  }

  return (
    <AnchoredPanel
      anchorRef={anchorRef}
      onClose={onClose}
      width={300}
      estimatedHeight={340}
      label="Attach something"
      className="p-4 flex flex-col gap-2.5"
    >
      <PanelLabel>Attach</PanelLabel>

      <div className="flex items-center gap-2 border border-border-default rounded-[9px] px-[11px] py-2">
        <SearchIcon size={13} className="text-text-muted flex-shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your notes"
          aria-label="Search your notes"
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-12.5 text-text-primary placeholder:text-text-muted"
        />
      </div>

      <div className="flex flex-col gap-1">
        {results.map((note) => (
          <button
            key={note.id}
            type="button"
            disabled={busy}
            onClick={() => linkNote(note.id)}
            className="flex items-center gap-2.5 rounded-[9px] px-[11px] py-2 text-12.5 text-text-primary hover:bg-bg-surface transition-colors duration-120 disabled:opacity-50"
          >
            <span className="w-6 h-6 rounded-md bg-accent-blue-bg text-accent-blue-dark flex items-center justify-center flex-shrink-0">
              <NoteIcon size={12} />
            </span>
            <span className="truncate">{note.title || 'Untitled'}</span>
          </button>
        ))}
        {results.length === 0 && (
          <p className="m-0 text-11.5 text-text-faint px-[11px] py-2">
            {query ? 'No notes match that.' : 'No notes to link yet.'}
          </p>
        )}
      </div>

      <div className="border-t border-border-light pt-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={createLinkedNote}
          className="w-full text-left text-12.5 text-accent-blue-dark rounded-[9px] px-[11px] py-2 hover:bg-accent-blue-bg transition-colors duration-120 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'New note, linked to this to-do'}
        </button>
        <p className="m-0 text-11 text-text-muted leading-[1.5] px-[11px] pt-1.5">
          Files are attached from the note editor, where the upload already
          lives — this keeps one path to R2 rather than two.
        </p>
      </div>
    </AnchoredPanel>
  );
}
