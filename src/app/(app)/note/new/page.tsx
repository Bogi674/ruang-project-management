'use client';

import { useEffect, useRef, useState } from 'react';
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
  const createdRef = useRef(false);

  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;

    fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setNoteId(data.id);
          setCreating(false);
          window.history.replaceState(null, '', `/note/${data.id}`);
        }
      })
      .catch(() => router.replace('/home'));
  }, []);

  if (creating || !noteId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <NoteEditor noteId={noteId} isNew initialWidgetType={initialWidget} />;
}
