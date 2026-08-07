'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Note } from '@/types';
import { formatRelativeTime, extractTitleFromTipTap } from '@/lib/utils';
import { TagChip } from './TagChip';

interface NoteRowProps {
  note: Note;
  showAssign?: boolean;
  onAssign?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
  selected?: boolean;
  onToggleSelect?: (noteId: string) => void;
}

export function NoteRow({ note, showAssign, onAssign, onDelete, selected, onToggleSelect }: NoteRowProps) {
  const router = useRouter();
  const title = note.title || extractTitleFromTipTap(note.content) || 'Untitled';
  const [pinned, setPinned] = useState(note.is_pinned_to_home);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handlePin(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = !pinned;
    setPinned(next);
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned_to_home: next }),
    });
    router.refresh();
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
    onDelete?.(note.id);
    router.refresh();
  }

  return (
    <div
      className="flex items-center gap-2 px-4 py-3 min-h-[48px] border-b border-border-light last:border-b-0 hover:bg-bg-surface transition-colors duration-80 group"
      onMouseLeave={() => setConfirmDelete(false)}
    >
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect?.(note.id); }}
        className={`w-3.5 h-3.5 border rounded-[3px] flex-shrink-0 flex items-center justify-center transition-colors ${
          selected
            ? 'bg-accent-blue border-accent-blue'
            : 'border-border-medium hover:border-accent-blue'
        }`}
      >
        {selected && (
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1.5,5 4,7.5 8.5,2.5" />
          </svg>
        )}
      </button>
      <Link href={`/note/${note.id}`} className="flex-1 min-w-0 no-underline">
        <p className="text-[13.5px] text-text-primary truncate">{title}</p>
      </Link>
      {note.space && <TagChip label={note.space.name} variant="green" size="sm" />}
      {note.tags?.[0] && !note.space && <TagChip label={note.tags[0]} variant="blue" size="sm" />}
      {showAssign && onAssign && (
        <button
          onClick={() => onAssign(note.id)}
          className="hidden group-hover:flex text-[11px] text-text-muted border border-border-default rounded-full px-2.5 py-1 hover:text-text-secondary transition-colors duration-120"
        >
          Assign →
        </button>
      )}

      {/* Pin */}
      <button
        onClick={handlePin}
        title={pinned ? 'Unpin' : 'Pin to home'}
        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-120 flex-shrink-0 ${
          pinned
            ? 'text-accent-blue-dark bg-accent-blue-bg'
            : 'text-text-faint opacity-0 group-hover:opacity-100 hover:text-text-secondary'
        }`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
        </svg>
      </button>

      {/* Delete */}
      {confirmDelete ? (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleDelete}
            className="h-6 px-2 text-[11px] font-medium text-white bg-danger rounded-md"
          >Delete</button>
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDelete(false); }}
            className="h-6 px-2 text-[11px] text-text-muted hover:text-text-secondary rounded-md"
          >Cancel</button>
        </div>
      ) : (
        <button
          onClick={handleDelete}
          title="Delete note"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-text-faint opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-danger-bg transition-all duration-120 flex-shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      )}

      <span className="text-[11px] text-text-faint flex-shrink-0 ml-1">{formatRelativeTime(note.updated_at)}</span>
    </div>
  );
}
