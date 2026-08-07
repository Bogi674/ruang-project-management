'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WidgetType } from '@/types';
import { NoteEditor } from '../NoteEditor';

export default function NewNotePage() {
  const router = useRouter();
  const params = useSearchParams();
  const type = params.get('type') === 'checklist' ? 'checklist' : 'note';
  const initialWidget = params.get('widget') as WidgetType | null;
  const [noteId, setNoteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(true);
  const hasEditedRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    // Track the note ID at closure scope so cleanup can access it
    // even if the component unmounts before the fetch resolves.
    let resolvedNoteId: string | null = null;

    fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.id) return;
        resolvedNoteId = data.id;

        // If the cleanup already fired (Strict Mode remount or fast navigation),
        // delete the orphaned note instead of showing it.
        if (controller.signal.aborted) {
          fetch(`/api/notes/${data.id}`, { method: 'DELETE', keepalive: true });
          return;
        }

        setNoteId(data.id);
        setCreating(false);
        window.history.replaceState(null, '', `/note/${data.id}`);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') router.replace('/home');
      });

    return () => {
      controller.abort();
      // If the fetch already resolved before cleanup fired, delete the note.
      if (resolvedNoteId && !hasEditedRef.current) {
        fetch(`/api/notes/${resolvedNoteId}`, { method: 'DELETE', keepalive: true });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFirstEdit = useCallback(() => {
    hasEditedRef.current = true;
  }, []);

  if (creating || !noteId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <NoteEditor noteId={noteId} isNew onFirstEdit={handleFirstEdit} initialWidgetType={initialWidget} />;
}
