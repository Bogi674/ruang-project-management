'use client';

import Link from 'next/link';
import { Note } from '@/types';
import { formatRelativeTime, extractTitleFromTipTap } from '@/lib/utils';
import { TagChip } from './TagChip';

interface NoteRowProps {
  note: Note;
  showAssign?: boolean;
  onAssign?: (noteId: string) => void;
}

export function NoteRow({ note, showAssign, onAssign }: NoteRowProps) {
  const title = note.title || extractTitleFromTipTap(note.content) || 'Untitled';

  return (
    <div className="flex items-center gap-3 px-4 py-3 min-h-[52px] border-b border-border-light last:border-b-0 hover:bg-bg-surface transition-colors duration-80 group">
      <div className="w-3.5 h-3.5 border border-border-medium rounded-[3px] flex-shrink-0" />
      <Link href={`/note/${note.id}`} className="flex-1 min-w-0 no-underline">
        <p className="text-13.5 text-text-primary truncate">{title}</p>
      </Link>
      {note.space && <TagChip label={note.space.name} variant="green" size="sm" />}
      {note.tags?.[0] && !note.space && <TagChip label={note.tags[0]} variant="blue" size="sm" />}
      {showAssign && onAssign && (
        <button
          onClick={() => onAssign(note.id)}
          className="hidden group-hover:flex text-11 text-text-muted border border-border-default rounded-full px-2.5 py-1 hover:text-text-secondary transition-colors duration-120"
        >
          Assign →
        </button>
      )}
      <span className="text-11 text-text-faint flex-shrink-0">{formatRelativeTime(note.updated_at)}</span>
    </div>
  );
}
