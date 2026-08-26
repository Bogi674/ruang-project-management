'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Note, Todo, TodoAttachment } from '@/types';
import { AnchoredPanel, PanelLabel } from '../AnchoredPanel';
import { NoteIcon, PaperclipIcon, SearchIcon } from '../icons';
import { useTodoActions } from '../TodoProvider';

type UploadState =
  | { phase: 'idle' }
  | { phase: 'uploading'; filename: string; progress: number }
  | { phase: 'error'; message: string };

/**
 * Attach popover.
 *
 * Two paths to the same place:
 *  1. Attach an existing note by searching for it.
 *  2. Upload a file directly — drop it or browse for it.
 *
 * Creating a linked note is still a one-click action at the bottom.
 *
 * File uploads use /api/todos/[id]/upload (GET for presigned URL, POST to
 * save metadata and create the attachment) — requires supabase_schema_phase10
 * to have been applied so files.widget_id is nullable.
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
  const [uploadState, setUploadState] = useState<UploadState>({ phase: 'idle' });
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/notes')
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Note[]) => {
        if (!cancelled) setNotes(Array.isArray(data) ? data : []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
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

  async function uploadFile(file: File) {
    if (uploadState.phase === 'uploading') return;

    setUploadState({ phase: 'uploading', filename: file.name, progress: 0 });

    try {
      /*
       * Single server-side upload: the file travels to our Next.js route, which
       * puts it to R2 directly. This avoids requiring R2 CORS rules for
       * browser-side PUT, which was the root cause of the "Failed to fetch" error
       * users saw when the bucket had no CORS policy configured.
       */
      const form = new FormData();
      form.append('file', file, file.name);

      setUploadState({ phase: 'uploading', filename: file.name, progress: 40 });

      const saveRes = await fetch(`/api/todos/${todo.id}/upload`, {
        method: 'POST',
        body: form,
        // Do NOT set Content-Type — the browser sets it with the correct boundary.
      });
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => null);
        throw new Error(err?.error || 'Upload failed');
      }

      setUploadState({ phase: 'uploading', filename: file.name, progress: 90 });

      const attachment = (await saveRes.json()) as TodoAttachment;
      await attach(todo.id, { _already_created: attachment });
      setUploadState({ phase: 'idle' });
      onClose();
    } catch (err) {
      setUploadState({ phase: 'error', message: err instanceof Error ? err.message : 'Upload failed' });
    }
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todo.id, uploadState.phase]
  );

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
      width={320}
      estimatedHeight={420}
      label="Attach something"
      className="p-4 flex flex-col gap-3"
    >
      <PanelLabel>Attach</PanelLabel>

      {/* ── File drop zone ── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-[10px] border-2 border-dashed transition-colors duration-120 ${
          dragOver ? 'border-accent-blue bg-accent-blue-bg' : 'border-border-default'
        }`}
      >
        {uploadState.phase === 'uploading' ? (
          <div className="flex flex-col items-center gap-2 px-4 py-4">
            <span className="text-12 text-text-secondary">{uploadState.filename}</span>
            <div className="w-full h-1.5 rounded-full bg-bg-elevated overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-blue transition-all duration-300"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
            <span className="text-11 text-text-faint">Uploading…</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-4 text-center">
            <span className="w-8 h-8 rounded-btn bg-bg-elevated text-text-secondary flex items-center justify-center">
              <PaperclipIcon size={16} />
            </span>
            <span className="text-12 text-text-secondary">
              Drop a file here, or{' '}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-accent-blue-dark underline decoration-border-medium underline-offset-2 hover:no-underline"
              >
                browse
              </button>
            </span>
            <span className="text-11 text-text-faint">Max 50 MB</span>
          </div>
        )}
        {uploadState.phase === 'error' && (
          <p className="text-11.5 text-danger px-4 pb-3 text-center">{uploadState.message}</p>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
          e.target.value = '';
        }}
      />

      {/* ── Note search ── */}
      <div>
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-2">
          Link a note
        </p>
        <div className="flex items-center gap-2 border border-border-default rounded-[9px] px-[11px] py-2 mb-2">
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
      </div>
    </AnchoredPanel>
  );
}
