'use client';

import { useState } from 'react';
import { Project, ProjectStatus } from '@/types';

const COLOR_OPTIONS = [
  '#A1B5D8', '#C2D8B9', '#F08050', '#E8B23C', '#9b7ec8', '#d4879a',
];

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'todo',        label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'on_hold',     label: 'On hold' },
  { value: 'completed',   label: 'Completed' },
];

interface Props {
  project?: Project;
  onSave: (data: Partial<Project>) => Promise<void>;
  onClose: () => void;
}

export function ProjectModal({ project, onSave, onClose }: Props) {
  const [name, setName]           = useState(project?.name ?? '');
  const [color, setColor]         = useState(project?.color ?? '#A1B5D8');
  const [status, setStatus]       = useState<ProjectStatus>(project?.status ?? 'todo');
  const [description, setDesc]    = useState(project?.description ?? '');
  const [startDate, setStart]     = useState(project?.start_date ?? '');
  const [endDate, setEnd]         = useState(project?.end_date ?? '');
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setErr('Name is required'); return; }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), color, status, description: description || undefined, start_date: startDate || undefined, end_date: endDate || undefined });
      onClose();
    } catch {
      setErr('Failed to save. Try again.');
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
        style={{ background: 'var(--bg-base)', borderRadius: 12, width: 480, maxWidth: '95vw', boxShadow: '0 16px 56px rgba(44,56,72,.14), 0 2px 8px rgba(44,56,72,.06)', padding: '28px 28px 24px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 20, fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 20px' }}>
          {project ? 'Edit project' : 'New project'}
        </h2>

        <form onSubmit={handleSubmit}>
          {/* Name */}
          <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Name</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            style={{ width: '100%', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '8px 10px', fontSize: 14, color: 'var(--text-primary)', background: 'var(--bg-base)', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
          />

          {/* Color */}
          <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 6 }}>Color</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: c === color ? '2.5px solid var(--text-primary)' : '2px solid transparent', cursor: 'pointer', transition: 'border-color 0.1s' }}
              />
            ))}
          </div>

          {/* Status */}
          <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ProjectStatus)}
            style={{ width: '100%', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '8px 10px', fontSize: 13.5, color: 'var(--text-primary)', background: 'var(--bg-base)', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Description */}
          <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Description <span style={{ color: 'var(--text-faint)' }}>(optional)</span></label>
          <textarea
            value={description}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What is this project about?"
            rows={2}
            style={{ width: '100%', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '8px 10px', fontSize: 13.5, color: 'var(--text-primary)', background: 'var(--bg-base)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', marginBottom: 14, fontFamily: 'inherit' }}
          />

          {/* Dates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>Start date</label>
              <input type="date" value={startDate} onChange={(e) => setStart(e.target.value)}
                style={{ width: '100%', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '7px 10px', fontSize: 13.5, color: 'var(--text-primary)', background: 'var(--bg-base)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 4 }}>End date</label>
              <input type="date" value={endDate} onChange={(e) => setEnd(e.target.value)}
                style={{ width: '100%', border: '1px solid var(--border-medium)', borderRadius: 8, padding: '7px 10px', fontSize: 13.5, color: 'var(--text-primary)', background: 'var(--bg-base)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          {err && <p style={{ fontSize: 12.5, color: 'var(--danger)', margin: '0 0 12px' }}>{err}</p>}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
              {saving ? 'Saving…' : project ? 'Save changes' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
