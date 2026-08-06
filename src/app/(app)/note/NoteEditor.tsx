'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Note, Widget, WidgetType, AutosaveState } from '@/types';
import { TipTapEditor } from '@/components/editor/TipTapEditor';
import { WidgetPicker } from '@/components/widgets/WidgetPicker';
import { ReminderWidget } from '@/components/widgets/ReminderWidget';
import { FileWidget } from '@/components/widgets/FileWidget';
import { LinkWidget } from '@/components/widgets/LinkWidget';
import { AutosaveIndicator } from '@/components/layout/AutosaveIndicator';
import { scheduleSync, loadDraft } from '@/lib/autosave';
import { extractTitleFromTipTap, formatRelativeTime } from '@/lib/utils';

interface NoteEditorProps {
  noteId: string;
  initialNote?: Note;
  isNew?: boolean;
  initialWidgetType?: WidgetType | null;
}

export function NoteEditor({ noteId, initialNote, isNew, initialWidgetType }: NoteEditorProps) {
  const router = useRouter();
  const [autosave, setAutosave] = useState<AutosaveState>({ status: 'idle', lastSaved: null });
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>(initialNote?.widgets || []);
  const [content, setContent] = useState<object | null>(() => {
    const draft = loadDraft(noteId);
    return draft || initialNote?.content || null;
  });

  const title = extractTitleFromTipTap(content) || 'Untitled';

  useEffect(() => {
    if (initialWidgetType) handleAddWidget(initialWidgetType);
  }, []);

  const handleChange = useCallback(
    (newContent: object) => {
      setContent(newContent);
      scheduleSync(noteId, newContent, setAutosave);
    },
    [noteId]
  );

  async function handleAddWidget(type: WidgetType) {
    const defaultContent =
      type === 'reminder'
        ? { title: '', date: null, time: null, recurrence: 'once', type_label: 'Deadline' }
        : type === 'file'
        ? { description: '' }
        : { url: '', og_title: '', og_description: '', og_image: null, note: '' };

    const res = await fetch('/api/widgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note_id: noteId, type, content: defaultContent }),
    });
    const widget = await res.json();
    if (widget.id) setWidgets((prev) => [...prev, widget]);
  }

  async function handleRemoveWidget(widgetId: string) {
    await fetch(`/api/widgets/${widgetId}`, { method: 'DELETE' });
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
  }

  return (
    <div className="flex flex-col h-[calc(100vh-52px)] md:h-[calc(100vh-52px)]">
      {/* Desktop back + breadcrumb */}
      <div className="hidden md:block px-20 pt-11">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-12 text-text-muted hover:text-text-secondary transition-colors mb-3"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back
        </button>
        <div className="flex items-center gap-2 mb-1">
          {initialNote?.space && (
            <>
              <Link href={`/space/${initialNote.space.id}`} className="text-12 text-text-faint hover:text-text-muted no-underline">
                {initialNote.space.name}
              </Link>
              <span className="text-12 text-text-faint">›</span>
            </>
          )}
        </div>
      </div>

      {/* Title area */}
      <div className="px-8 md:px-20 pb-4 max-w-[820px] md:mx-auto w-full flex-shrink-0">
        <h1
          className="font-serif text-[26px] md:text-[32px] text-text-primary leading-tight w-full"
          style={{ letterSpacing: '-0.025em', lineHeight: 1.2 }}
        >
          {title || <span className="text-text-muted">Untitled</span>}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <p className="text-11.5 text-text-faint">
            {initialNote ? formatRelativeTime(initialNote.updated_at) : 'New note'}
          </p>
          <AutosaveIndicator state={autosave} />
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden flex flex-col px-8 md:px-20 max-w-[820px] md:mx-auto w-full pb-2">
        <TipTapEditor
          content={content}
          isChecklist={initialNote?.type === 'checklist'}
          onChange={handleChange}
        />
      </div>

      {/* Widgets zone */}
      {widgets.length > 0 && (
        <div className="px-8 md:px-20 max-w-[820px] md:mx-auto w-full border-t border-[#edf3fa] pt-4 pb-2 flex-shrink-0">
          <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-3">Attached</p>
          <div className="space-y-2">
            {widgets.map((w) => {
              if (w.type === 'reminder')
                return <ReminderWidget key={w.id} content={w.content as never} onRemove={() => handleRemoveWidget(w.id)} />;
              if (w.type === 'file')
                return <FileWidget key={w.id} file={w.file} onRemove={() => handleRemoveWidget(w.id)} />;
              if (w.type === 'link')
                return <LinkWidget key={w.id} content={w.content as never} onRemove={() => handleRemoveWidget(w.id)} />;
              return null;
            })}
          </div>
        </div>
      )}

      {showWidgetPicker && (
        <WidgetPicker
          onSelect={handleAddWidget}
          onClose={() => setShowWidgetPicker(false)}
        />
      )}
    </div>
  );
}
