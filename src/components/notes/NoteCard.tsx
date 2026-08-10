'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Note } from '@/types';
import { formatRelativeTime, extractTitleFromTipTap } from '@/lib/utils';
import { TagChip } from './TagChip';
import { SpaceAssignMenu } from '@/components/spaces/SpaceAssignMenu';
import { setNoteDragData, moveNoteToSpace, emitNotesChanged } from '@/lib/dnd';

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
  const [dragging, setDragging] = useState(false);
  const currentSpaceId = note.space_id ?? note.space?.id ?? null;
  const hasChips = !!note.space || (note.tags?.length ?? 0) > 0;

  async function handleAssignSpace(nextSpaceId: string | null) {
    if (nextSpaceId === currentSpaceId) return;
    const ok = await moveNoteToSpace(note.id, nextSpaceId);
    if (!ok) return;
    emitNotesChanged();
    router.refresh();
  }

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
    emitNotesChanged();
    router.refresh();
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(false);
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        setNoteDragData(e, { noteId: note.id, fromSpaceId: currentSpaceId });
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={`relative group bg-bg-base border border-border-default rounded-card shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-150 ${
        dragging ? 'opacity-40' : ''
      }`}
      onMouseLeave={() => setConfirmDelete(false)}
    >
      <Link href={`/note/${note.id}`} className="block no-underline px-4 pt-3 pb-4 cursor-pointer">
        {/* Chips row reserves a gutter on the right so nothing runs underneath
            the floating delete / move / pin buttons. */}
        {hasChips && (
          <div className="flex items-start gap-2 min-h-[28px]">
            <div className="flex flex-wrap gap-1 flex-1 min-w-0">
              {note.space && (
                <TagChip label={note.space.name} size="sm" color={note.space.color} showDot />
              )}
              {note.tags?.slice(0, 2).map((tag) => (
                <TagChip key={tag} label={tag} variant="blue" size="sm" />
              ))}
            </div>
            <span className="w-24 flex-shrink-0" aria-hidden />
          </div>
        )}

        {/* Two lines on mobile, one on desktop — never more. Without chips the
            title is the top element, so it carries the gutter itself. */}
        <p
          className={`font-serif text-[15.5px] text-text-primary leading-snug line-clamp-2 md:line-clamp-1 ${
            hasChips ? '' : 'pr-24'
          }`}
        >
          {title}
        </p>

        {/* Always one line of subtext, ellipsised when it runs long. */}
        <p className="text-[11.5px] text-text-muted leading-relaxed truncate mt-1">
          {preview || 'No additional text'}
        </p>

        <p className="text-[10.5px] text-text-faint mt-2.5">{formatRelativeTime(note.updated_at)}</p>
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
          /* Card actions stay visible on touch and are hover-revealed on desktop. */
          <button
            onClick={handleDelete}
            title="Delete note"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-faint opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-danger hover:bg-danger-bg transition-all duration-120"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        )}

        {/* Move to space */}
        {!confirmDelete && (
          <SpaceAssignMenu currentSpaceId={currentSpaceId} onSelect={handleAssignSpace}>
            {({ onClick, open }) => (
              <button
                onClick={onClick}
                title="Move to space"
                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-120 ${
                  open
                    ? 'text-accent-blue-dark bg-accent-blue-bg opacity-100'
                    : 'text-text-faint opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-text-secondary hover:bg-bg-surface'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-7.6l-1.7-2.3A1 1 0 0 0 9.9 4H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z"/>
                </svg>
              </button>
            )}
          </SpaceAssignMenu>
        )}

        {/* Pin */}
        {!confirmDelete && (
          <button
            onClick={handlePin}
            title={pinned ? 'Unpin from home' : 'Pin to home'}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-120 ${
              pinned
                ? 'text-accent-amber bg-accent-amber-bg opacity-100'
                : 'text-text-faint opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:text-accent-amber hover:bg-accent-amber-bg'
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
