'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Note, Widget, WidgetType, AutosaveState, Space } from '@/types';
import { TipTapEditor } from '@/components/editor/TipTapEditor';
import { VersionHistory } from '@/components/editor/VersionHistory';
import { WidgetPicker } from '@/components/widgets/WidgetPicker';
import { ReminderWidget } from '@/components/widgets/ReminderWidget';
import { FileWidget } from '@/components/widgets/FileWidget';
import { LinkWidget } from '@/components/widgets/LinkWidget';
import { AutosaveIndicator } from '@/components/layout/AutosaveIndicator';
import { scheduleSync, loadDraft } from '@/lib/autosave';
import { formatDate } from '@/lib/utils';

interface NoteEditorProps {
  noteId: string;
  initialNote?: Note;
  isNew?: boolean;
  initialWidgetType?: WidgetType | null;
  onFirstEdit?: () => void;
}

function formatCreatedAt(dateStr: string): string {
  const d = new Date(dateStr);
  const pad = (n: number) => String(n).padStart(2, '0');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${pad(d.getDate())} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

function defaultTitle(createdAt?: string): string {
  const d = createdAt ? new Date(createdAt) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `Untitled ${days[d.getDay()]}, ${pad(d.getDate())} ${months[d.getMonth()]}, ${d.getFullYear()}`;
}

export function NoteEditor({ noteId, initialNote, isNew, initialWidgetType, onFirstEdit }: NoteEditorProps) {
  const router = useRouter();
  const hasCalledFirstEdit = useRef(false);
  const [autosave, setAutosave] = useState<AutosaveState>({ status: 'idle', lastSaved: null });
  const [showWidgetPicker, setShowWidgetPicker] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>(initialNote?.widgets || []);
  const [isLocked, setIsLocked] = useState(initialNote?.is_locked ?? false);
  const [content, setContent] = useState<object | null>(() => {
    const draft = loadDraft(noteId);
    return draft || initialNote?.content || null;
  });
  const [noteTitle, setNoteTitle] = useState(initialNote?.title || '');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(initialNote?.space_id || null);
  const [showSpacePicker, setShowSpacePicker] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const createdAt = initialNote?.created_at || new Date().toISOString();

  useEffect(() => {
    if (initialWidgetType) handleAddWidget(initialWidgetType);
    fetch('/api/spaces').then(r => r.json()).then(d => setSpaces(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
  }, [noteTitle]);

  const selectedSpace = spaces.find(s => s.id === selectedSpaceId) || initialNote?.space || null;

  const triggerSync = useCallback(
    (newContent: object, title: string) => {
      const finalTitle = title.trim() || defaultTitle(createdAt);
      scheduleSync(noteId, newContent, setAutosave, finalTitle);
    },
    [noteId, createdAt]
  );

  const notifyFirstEdit = useCallback(() => {
    if (onFirstEdit && !hasCalledFirstEdit.current) {
      hasCalledFirstEdit.current = true;
      onFirstEdit();
    }
  }, [onFirstEdit]);

  const handleChange = useCallback(
    (newContent: object) => {
      setContent(newContent);
      notifyFirstEdit();
      triggerSync(newContent, noteTitle);
    },
    [noteId, noteTitle, triggerSync, notifyFirstEdit]
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setNoteTitle(val);
      notifyFirstEdit();
      if (content) triggerSync(content, val);
    },
    [content, triggerSync, notifyFirstEdit]
  );

  async function handleSpaceSelect(spaceId: string | null) {
    setSelectedSpaceId(spaceId);
    setShowSpacePicker(false);
    await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ space_id: spaceId }),
    });
  }

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
      body: JSON.stringify({ content, title: noteTitle }),
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
    a.download = `${noteTitle || 'note'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleExportPDF() {
    window.print();
  }

  async function handleDeleteNote() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    await fetch(`/api/notes/${noteId}`, { method: 'DELETE' });
    router.push('/home');
    router.refresh();
  }

  function handleRestoreVersion(restoredContent: object) {
    setContent(restoredContent);
    scheduleSync(noteId, restoredContent, setAutosave, noteTitle);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-52px)] md:h-[calc(100vh-52px)]">
      {/* Desktop back + breadcrumb + actions */}
      <div className="hidden md:flex items-start justify-between px-20 pt-8 pb-2 max-w-[820px] md:mx-auto w-full flex-shrink-0">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-[12px] text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </button>
          {initialNote?.space && (
            <div className="flex items-center gap-1">
              <Link href={`/space/${initialNote.space.id}`} className="text-[11px] text-text-faint hover:text-text-muted no-underline">
                {initialNote.space.name}
              </Link>
              <span className="text-[11px] text-text-faint">›</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <AutosaveIndicator state={autosave} />
          <button
            onClick={handleToggleLock}
            title={isLocked ? 'Unlock note' : 'Lock note'}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
          >
            {isLocked ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            )}
          </button>
          <button
            onClick={handleSaveVersion}
            title="Save version checkpoint"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </button>
          <button
            onClick={() => setShowVersionHistory(true)}
            title="Version history"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>
            </svg>
          </button>
          <div className="relative group">
            <button
              title="Export note"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors duration-120"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <div className="absolute right-0 top-full mt-1 w-36 bg-bg-base border border-border-default rounded-[10px] py-1 z-20 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-120"
              style={{ boxShadow: 'var(--shadow-modal)' }}>
              <button onClick={handleExportText} className="w-full text-left px-3 py-2 text-[13px] text-text-secondary hover:bg-bg-surface transition-colors duration-80">Plain text</button>
              <button onClick={handleExportPDF} className="w-full text-left px-3 py-2 text-[13px] text-text-secondary hover:bg-bg-surface transition-colors duration-80">Print / PDF</button>
            </div>
          </div>

          {/* Delete */}
          <div className="w-px h-4 bg-border-default mx-1" />
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDeleteNote}
                disabled={deleting}
                className="h-7 px-2.5 text-[12px] font-medium text-white bg-danger rounded-lg transition-colors"
              >{deleting ? '…' : 'Delete'}</button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="h-7 px-2.5 text-[12px] text-text-muted hover:text-text-secondary rounded-lg"
              >Cancel</button>
            </div>
          ) : (
            <button
              onClick={handleDeleteNote}
              title="Delete note"
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-danger-bg hover:text-danger transition-colors duration-120"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Title area */}
      <div className="px-8 md:px-20 max-w-[820px] md:mx-auto w-full flex-shrink-0">
        <textarea
          ref={titleRef}
          value={noteTitle}
          onChange={handleTitleChange}
          placeholder="Untitled"
          disabled={isLocked}
          rows={1}
          className="w-full resize-none overflow-hidden font-serif text-[28px] md:text-[32px] text-text-primary bg-transparent border-none outline-none placeholder:text-text-faint leading-tight disabled:cursor-not-allowed"
          style={{ letterSpacing: '-0.025em', lineHeight: 1.2 }}
        />

        {/* Metadata row */}
        <div className="flex items-center gap-3 flex-wrap mt-1 mb-3">
          <span className="text-[11px] text-text-faint">
            Created: {formatCreatedAt(createdAt)}
          </span>
          {isLocked && (
            <span className="text-[11px] font-medium text-text-faint bg-bg-surface border border-border-light rounded-full px-2 py-0.5">
              Locked
            </span>
          )}

          {/* Space chip */}
          <div className="relative">
            <button
              onClick={() => !isLocked && setShowSpacePicker(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors duration-120 border ${
                selectedSpace
                  ? 'bg-accent-green text-accent-green-dark border-accent-green-mid'
                  : 'bg-bg-surface text-text-muted border-border-light hover:border-border-medium'
              } ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {selectedSpace ? (
                <>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selectedSpace.color || '#738290' }} />
                  {selectedSpace.name}
                  {!isLocked && (
                    <span
                      onClick={(e) => { e.stopPropagation(); handleSpaceSelect(null); }}
                      className="ml-0.5 text-accent-green-dark hover:text-danger"
                    >
                      ×
                    </span>
                  )}
                </>
              ) : (
                <>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
                  </svg>
                  Add to space
                </>
              )}
            </button>

            {showSpacePicker && (
              <div
                className="absolute left-0 top-full mt-1 w-48 bg-bg-base border border-border-default rounded-[10px] py-1.5 z-30 shadow-lg"
                style={{ boxShadow: 'var(--shadow-modal)' }}
              >
                <button
                  onClick={() => handleSpaceSelect(null)}
                  className="w-full text-left px-3 py-1.5 text-[12px] text-text-muted hover:bg-bg-surface transition-colors"
                >
                  No space (Storeroom)
                </button>
                {spaces.length > 0 && <div className="h-px bg-border-light mx-2 my-1" />}
                {spaces.map(space => (
                  <button
                    key={space.id}
                    onClick={() => handleSpaceSelect(space.id)}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-text-secondary hover:bg-bg-surface transition-colors flex items-center gap-2"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: space.color || '#738290' }} />
                    {space.icon && `${space.icon} `}{space.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Editor with toolbar at top */}
      <div className="flex-1 overflow-hidden flex flex-col px-8 md:px-20 max-w-[820px] md:mx-auto w-full pb-2">
        <TipTapEditor
          content={content}
          isChecklist={initialNote?.type === 'checklist'}
          onChange={handleChange}
          editable={!isLocked}
          onAddWidget={() => setShowWidgetPicker(true)}
          toolbarPosition="top"
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
        <WidgetPicker onSelect={handleAddWidget} onClose={() => setShowWidgetPicker(false)} />
      )}

      {showVersionHistory && (
        <VersionHistory noteId={noteId} onRestore={handleRestoreVersion} onClose={() => setShowVersionHistory(false)} />
      )}

      {showSpacePicker && (
        <div className="fixed inset-0 z-20" onClick={() => setShowSpacePicker(false)} />
      )}
    </div>
  );
}
