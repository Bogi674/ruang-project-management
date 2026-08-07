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
}

export function NoteRow({ note, showAssign, onAssign }: NoteRowProps) {
  const router = useRouter();
  const title = note.title || extractTitleFromTipTap(note.content) || 'Untitled';
  const [pinned, setPinned] = useState(note.is_pinned_to_home);

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

  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[52px] border-b border-border-light last:border-b-0 hover:bg-bg-surface transition-colors duration-80 group">
      <div className="w-3.5 h-3.5 border border-border-medium rounded-[3px] flex-shrink-0" />
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
      <span className="text-[11px] text-text-faint flex-shrink-0">{formatRelativeTime(note.updated_at)}</span>
    </div>
  );
}
