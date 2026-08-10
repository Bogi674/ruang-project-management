'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Note } from '@/types';
import { extractTitleFromTipTap } from '@/lib/utils';
import { NOTES_CHANGED_EVENT, setNoteDragData } from '@/lib/dnd';

/**
 * Notes inside one space, listed inline in the sidebar tree.
 *
 * Mounted only while its space row is expanded, so the fetch is lazy: a user
 * with twenty spaces does not pay twenty requests to render the sidebar.
 */
export function SpaceNoteList({
  spaceId,
  limit = 30,
  onNavigate,
}: {
  spaceId: string;
  limit?: number;
  /** Lets the mobile drawer close itself when a note is opened. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [notes, setNotes] = useState<Note[] | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    fetch(`/api/notes?space_id=${spaceId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setNotes(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setNotes([]);
      });
    return () => { cancelled = true; };
  }, [spaceId]);

  useEffect(() => load(), [load]);

  // A note dragged into or out of this space, renamed, or deleted elsewhere
  // in the app should be reflected here without a page reload.
  useEffect(() => {
    function onChanged() { load(); }
    window.addEventListener(NOTES_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(NOTES_CHANGED_EVENT, onChanged);
  }, [load]);

  if (notes === null) {
    return <li className="pl-6 pr-2 py-1 text-[11px] text-text-faint">Loading…</li>;
  }
  if (notes.length === 0) return null;

  const visible = notes.slice(0, limit);

  return (
    <>
      {visible.map((note) => {
        const title = note.title || extractTitleFromTipTap(note.content) || 'Untitled';
        const isActive = pathname === `/note/${note.id}`;
        return (
          <li key={note.id}>
            <Link
              href={`/note/${note.id}`}
              draggable
              onDragStart={(e) => setNoteDragData(e, { noteId: note.id, fromSpaceId: spaceId })}
              onClick={onNavigate}
              title={title}
              className={`flex items-center gap-1.5 pl-6 pr-2 py-1.5 rounded-lg text-[12px] no-underline transition-colors duration-120 ${
                isActive
                  ? 'bg-accent-blue-bg text-accent-blue-dark font-medium'
                  : 'text-text-muted hover:bg-border-light hover:text-text-secondary'
              }`}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="flex-shrink-0 opacity-70"
              >
                {note.type === 'checklist' ? (
                  <>
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </>
                ) : (
                  <>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </>
                )}
              </svg>
              <span className="truncate">{title}</span>
            </Link>
          </li>
        );
      })}
      {notes.length > visible.length && (
        <li>
          <Link
            href={`/space/${spaceId}`}
            onClick={onNavigate}
            className="block pl-6 pr-2 py-1 text-[11px] text-text-faint hover:text-text-secondary no-underline"
          >
            +{notes.length - visible.length} more…
          </Link>
        </li>
      )}
    </>
  );
}
