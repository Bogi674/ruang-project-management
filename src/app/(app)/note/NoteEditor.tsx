'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Note, Widget, WidgetType, AutosaveState } from '@/types';
import { TipTapEditor } from '@/components/editor/TipTapEditor';
import { VersionHistory } from '@/components/editor/VersionHistory';
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
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>(initialNote?.widgets || []);
  const [isLocked, setIsLocked] = useState(initialNote?.is_locked ?? false);
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

  async function handleToggleLock() {
    const next = !isLocked;
    setIsLocked(next);
    await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_locked: next }),
    });
  }

  async function handleSaveVersion() {
    await fetch(`/api/notes/${noteId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, title }),
    });
  }

  function handleExportText() {
    if (!content) return;
    const doc = content as { content?: Array<{ type: string; content?: Array<{ text?: string }> }> };
    const text = (doc.content || [])
      .map((node) => (node.content || []).map((n) => n.text || '').join(''))
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportPDF() {
    window.print();
  }

  function handleRestoreVersion(restoredContent: object) {
    setContent(restoredContent);
    scheduleSync(noteId, restoredContent, setAutosave);
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

      {/* Title area + action buttons */}
      <div className="px-8 md:px-20 pb-4 max-w-[820px] md:mx-auto w-full flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <h1
            className="font-serif text-[26px] md:text-[32px] text-text-primary leading-tight flex-1"
            style={{ letterSpacing: '-0.025em', lineHeight: 1.2 }}
          >
            {title || <span className="text-text-muted">Untitled</span>}
          </h1>

          {/* Action buttons */}
          <div className="flex items-center gap-1 pt-1 flex-shrink-0">
            {/* Lock/unlock */}
            <button
              onClick={handleToggleLock}
              title={isLocked ? 'Unlock note' : 'Lock note'}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
            >
              {isLocked ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              )}
            </button>

            {/* Save version */}
            <button
              onClick={handleSaveVersion}
              title="Save version checkpoint"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </button>

            {/* Version history */}
            <button
              onClick={() => setShowVersionHistory(true)}
              title="Version history"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v5h5"/>
                <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
              </svg>
            </button>

            {/* Export dropdown */}
            <div className="relative group">
              <button
                title="Export note"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-1 w-36 bg-bg-base border border-border-default rounded-[10px] py-1 z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-120"
                style={{ boxShadow: 'var(--shadow-modal)' }}>
                <button
                  onClick={handleExportText}
                  className="w-full text-left px-3 py-2 text-13 text-text-secondary hover:bg-bg-surface transition-colors duration-80"
                >
                  Plain text (.txt)
                </button>
                <button
                  onClick={handleExportPDF}
                  className="w-full text-left px-3 py-2 text-13 text-text-secondary hover:bg-bg-surface transition-colors duration-80"
                >
                  Print / PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <p className="text-11.5 text-text-faint">
            {initialNote ? formatRelativeTime(initialNote.updated_at) : 'New note'}
          </p>
          <AutosaveIndicator state={autosave} />
          {isLocked && (
            <span className="text-11 font-medium text-text-faint bg-bg-surface border border-border-light rounded-full px-2 py-0.5">
              Locked
            </span>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden flex flex-col px-8 md:px-20 max-w-[820px] md:mx-auto w-full pb-2">
        <TipTapEditor
          content={content}
          isChecklist={initialNote?.type === 'checklist'}
          onChange={handleChange}
          editable={!isLocked}
          onAddWidget={() => setShowWidgetPicker(true)}
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

      {showVersionHistory && (
        <VersionHistory
          noteId={noteId}
          onRestore={handleRestoreVersion}
          onClose={() => setShowVersionHistory(false)}
        />
      )}
    </div>
  );
}
