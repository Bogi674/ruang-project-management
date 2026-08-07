'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Note } from '@/types';
import { formatRelativeTime, extractTitleFromTipTap } from '@/lib/utils';
import { TagChip } from './TagChip';

function getPreview(content: object | null): string {
  if (!content) return '';
  const doc = content as { content?: Array<{ type: string; content?: Array<{ text?: string }> }> };
  const nodes = doc.content || [];
  for (let i = 1; i < nodes.length; i++) {
    const text = nodes[i].content?.map((n) => n.text || '').join('').trim();
    if (text) return text.slice(0, 100);
  }
  return '';
}

interface NoteCardProps {
  note: Note;
  onPinToggle?: (noteId: string, pinned: boolean) => void;
  onDelete?: (noteId: string) => void;
}

export function NoteCard({ note, onPinToggle, onDelete }: NoteCardProps) {
  const router = useRouter();
  const title = note.title || extractTitleFromTipTap(note.content) || 'Untitled';
  const preview = getPreview(note.content);
  const [pinned, setPinned] = useState(note.is_pinned_to_home);
  const [pinning, setPinning] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handlePin(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (pinning) return;
    setPinning(true);
    const next = !pinned;
    setPinned(next);
    await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_pinned_to_home: next }),
    });
    setPinning(false);
    onPinToggle?.(note.id, next);
    router.refresh();
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    await fetch(`/api/notes/${note.id}`, { method: 'DELETE' });
    onDelete?.(note.id);
    router.refresh();
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(false);
  }

  return (
    <div
      className="relative group bg-bg-base border border-border-default rounded-card shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-150"
      onMouseLeave={() => setConfirmDelete(false)}
    >
      <Link href={`/note/${note.id}`} className="block no-underline p-4 cursor-pointer">
        <div className="flex flex-wrap gap-1 mb-2">
          {note.space && <TagChip label={note.space.name} variant="green" size="sm" />}
          {note.tags?.slice(0, 2).map((tag) => (
            <TagChip key={tag} label={tag} variant="blue" size="sm" />
          ))}
        </div>
        <p className="font-serif text-[15px] text-text-primary leading-snug mb-1 line-clamp-2">{title}</p>
        {preview && (
          <p className="text-[11.5px] text-text-muted leading-relaxed line-clamp-2">{preview}</p>
        )}
        <p className="text-[10.5px] text-text-faint mt-2">{formatRelativeTime(note.updated_at)}</p>
      </Link>

      {/* Action buttons — top right */}
      <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5">
        {/* Delete */}
        {confirmDelete ? (
          <>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="h-6 px-2 flex items-center text-[11px] font-medium text-white bg-danger rounded-md transition-colors"
            >
              {deleting ? '…' : 'Delete'}
            </button>
            <button
              onClick={handleCancelDelete}
              className="h-6 px-2 flex items-center text-[11px] text-text-muted hover:text-text-secondary rounded-md transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={handleDelete}
            title="Delete note"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-faint opacity-0 group-hover:opacity-100 hover:text-danger hover:bg-danger-bg transition-all duration-120"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        )}

        {/* Pin */}
        {!confirmDelete && (
          <button
            onClick={handlePin}
            title={pinned ? 'Unpin from home' : 'Pin to home'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-120 ${
              pinned
                ? 'text-accent-blue-dark bg-accent-blue-bg opacity-100'
                : 'text-text-faint opacity-0 group-hover:opacity-100 hover:text-text-secondary hover:bg-bg-surface'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
