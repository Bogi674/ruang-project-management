'use client';

import { useState, useEffect, useRef } from 'react';
import { ProjectEntry, Workstream, EntryStatus } from '@/types';
import { EntryTypeIcon } from './EntryTypeIcon';
import { EntryStatusPill } from './EntryStatusPill';

interface EntryDetailPanelProps {
  entry: ProjectEntry;
  project: { name: string; color: string };
  workstream?: Workstream;
  onClose: () => void;
  onUpdate: (entryId: string, data: Partial<ProjectEntry>) => void;
  onDelete: (entryId: string) => void;
  backLabel?: string;
}

const STATUS_CYCLE: EntryStatus[] = ['todo', 'in_progress', 'blocked', 'done'];

const TYPE_LABELS: Record<string, string> = {
  note: 'Note',
  file: 'File',
  task: 'Task',
  reminder: 'Reminder',
  link: 'Link',
};

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function EntryDetailPanel({ entry, project, workstream, onClose, onUpdate, onDelete, backLabel = 'Back' }: EntryDetailPanelProps) {
  const [title, setTitle] = useState(entry.title);
  const [body, setBody] = useState(() => {
    if (typeof entry.content?.text === 'string') return entry.content.text as string;
    return '';
  });
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when entry changes
  useEffect(() => {
    setTitle(entry.title);
    setBody(typeof entry.content?.text === 'string' ? (entry.content.text as string) : '');
  }, [entry.id, entry.title, entry.content]);

  function autoResizeTextarea(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function cycleStatus() {
    if (entry.type !== 'task') return;
    const current = entry.status ?? 'todo';
    const idx = STATUS_CYCLE.indexOf(current);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    onUpdate(entry.id, { status: next });
  }

  function handleTitleBlur() {
    if (title !== entry.title) {
      onUpdate(entry.id, { title });
    }
  }

  function handleBodyBlur() {
    const prev = typeof entry.content?.text === 'string' ? (entry.content.text as string) : '';
    if (body !== prev) {
      onUpdate(entry.id, { content: { ...entry.content, text: body } });
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 52,
        bottom: 0,
        width: 400,
        background: 'var(--bg-base)',
        borderLeft: '1px solid var(--border-default)',
        boxShadow: '-4px 0 24px rgba(44,56,72,.08)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
        transform: 'translateX(0)',
        transition: 'transform 0.2s ease',
      }}
    >
      {/* Header */}
      <div style={{ height: 52, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
        <button
          onClick={onClose}
          style={{ fontSize: 12.5, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', whiteSpace: 'nowrap' }}
        >
          ← {backLabel}
        </button>

        <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)', background: 'var(--bg-surface)', borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap' }}>
            <EntryTypeIcon type={entry.type} />
            {TYPE_LABELS[entry.type] ?? entry.type}
          </span>

          {entry.type === 'task' && entry.status && (
            <button
              onClick={cycleStatus}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              title="Click to cycle status"
            >
              <EntryStatusPill status={entry.status} />
            </button>
          )}
        </span>

        <button
          onClick={onClose}
          style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Breadcrumb */}
      <div style={{ padding: '8px 20px 0', fontSize: 12, color: 'var(--text-faint)' }}>
        {project.name} › {workstream?.name ?? 'No workstream'}
      </div>

      {/* Title */}
      <div style={{ padding: '6px 20px 12px' }}>
        <textarea
          ref={titleRef}
          value={title}
          onChange={(e) => { setTitle(e.target.value); autoResizeTextarea(e.target); }}
          onBlur={handleTitleBlur}
          placeholder="Entry title…"
          rows={1}
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontFamily: 'Newsreader, Georgia, serif',
            fontSize: 22,
            fontWeight: 400,
            color: 'var(--text-primary)',
            background: 'transparent',
            lineHeight: 1.3,
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Meta fields */}
      <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {entry.type === 'task' ? (
          <>
            <div>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-faint)', display: 'block', marginBottom: 3 }}>Status</span>
              <button
                onClick={cycleStatus}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12.5, color: 'var(--text-primary)' }}
              >
                {entry.status ? entry.status.replace('_', ' ') : 'todo'}
              </button>
            </div>
            <div>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-faint)', display: 'block', marginBottom: 3 }}>Start</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{formatDate(entry.pinned_date)}</span>
            </div>
            <div>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-faint)', display: 'block', marginBottom: 3 }}>Due</span>
              <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{formatDate(entry.pinned_date_end)}</span>
            </div>
          </>
        ) : (
          <div>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-faint)', display: 'block', marginBottom: 3 }}>Date</span>
            <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{formatDate(entry.pinned_date)}</span>
          </div>
        )}
      </div>

      {/* Body area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {entry.type === 'task' ? (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onBlur={handleBodyBlur}
            placeholder="Add notes, context, details…"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 14,
              lineHeight: 1.78,
              color: 'var(--text-primary)',
              background: 'transparent',
              minHeight: 120,
              fontStyle: body ? 'normal' : 'italic',
              boxSizing: 'border-box',
            }}
          />
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {typeof entry.content?.text === 'string'
              ? (entry.content.text as string)
              : entry.content
                ? JSON.stringify(entry.content, null, 2)
                : <span style={{ color: 'var(--text-faint)', fontStyle: 'italic' }}>No content</span>}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-light)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => onDelete(entry.id)}
          style={{ fontSize: 12.5, color: 'var(--danger-dark)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          Delete entry
        </button>
      </div>
    </div>
  );
}
