'use client';

import { useState } from 'react';
import { EntryType, EntryStatus, Workstream } from '@/types';

const ENTRY_TYPES: { value: EntryType; label: string }[] = [
  { value: 'task',     label: 'Task' },
  { value: 'note',     label: 'Note' },
  { value: 'file',     label: 'File' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'link',     label: 'Link' },
];

const ENTRY_STATUSES: { value: EntryStatus; label: string }[] = [
  { value: 'todo',        label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'blocked',     label: 'Blocked' },
  { value: 'done',        label: 'Done' },
];

interface Props {
  workstreams: Workstream[];
  defaultWorkstreamId?: string;
  onSave: (data: { type: EntryType; title: string; workstream_id?: string; status?: EntryStatus }) => Promise<void>;
  onClose: () => void;
}

export function AddEntryModal({ workstreams, defaultWorkstreamId, onSave, onClose }: Props) {
  const [type, setType]             = useState<EntryType>('task');
  const [title, setTitle]           = useState('');
  const [wsId, setWsId]             = useState(defaultWorkstreamId ?? '');
  const [status, setStatus]         = useState<EntryStatus>('todo');
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setErr('Title is required'); return; }
    setSaving(true);
    try {
      await onSave({ type, title: title.trim(), workstream_id: wsId || undefined, status: type === 'task' ? status : undefined });
      onClose();
    } catch {
      setErr('Failed to create entry. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(44,56,72,.28)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{ background: 'var(--bg-base)', borderRadius: 12, width: 440, maxWidth: '95vw', boxShadow: '0 16px 56px rgba(44,56,72,.14), 0 2px 8px rgba(44,56,72,.06)', padding: '26px 26px 22px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 18px' }}>
          Add entry
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Type */}
          <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EntryType)}
            style={{ width: '100%', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '8px 10px', fontSize: 13.5, color: 'var(--text-primary)', background: 'var(--bg-base)', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
          >
            {ENTRY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {/* Title */}
          <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Title</label>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Entry title"
            style={{ width: '100%', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: 'var(--text-primary)', background: 'var(--bg-base)', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
          />

          {/* Workstream */}
          {workstreams.length > 0 && (
            <>
              <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Workstream</label>
              <select
                value={wsId}
                onChange={(e) => setWsId(e.target.value)}
                style={{ width: '100%', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '8px 10px', fontSize: 13.5, color: 'var(--text-primary)', background: 'var(--bg-base)', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
              >
                <option value="">No workstream</option>
                {workstreams.map((ws) => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
              </select>
            </>
          )}

          {/* Status (task only) */}
          {type === 'task' && (
            <>
              <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as EntryStatus)}
                style={{ width: '100%', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '8px 10px', fontSize: 13.5, color: 'var(--text-primary)', background: 'var(--bg-base)', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
              >
                {ENTRY_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </>
          )}

          {err && <p style={{ fontSize: 12.5, color: 'var(--danger)', margin: '0 0 10px' }}>{err}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-medium)', background: 'transparent', fontSize: 13.5, color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--accent-blue)', color: '#fff', fontSize: 13.5, fontWeight: 500, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Adding…' : 'Add entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
