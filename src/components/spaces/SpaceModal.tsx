'use client';

import { useState } from 'react';
import { Space } from '@/types';

const COLOR_PRESETS = [
  '#738290', '#A1B5D8', '#7eb87e', '#d4a574', '#d4879a',
  '#9b7ec8', '#e08080', '#80c8b0', '#c8b080', '#80a8c8',
];

const EMOJI_PRESETS = ['📁', '💼', '🎯', '📚', '🏠', '🌱', '💡', '🔬', '🎨', '⚙️', '📝', '🚀'];

interface SpaceModalProps {
  onClose: () => void;
  onCreated: () => void;
  parentId?: string | null;
  parentName?: string | null;
  /** When provided the modal edits this space instead of creating a new one. */
  editSpace?: Space | null;
}

export function SpaceModal({ onClose, onCreated, parentId, parentName, editSpace }: SpaceModalProps) {
  const isEdit = !!editSpace;
  const [name, setName] = useState(editSpace?.name || '');
  const [color, setColor] = useState(editSpace?.color || '#738290');
  const [icon, setIcon] = useState(editSpace?.icon || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setSaving(true);
    setError('');
    const res = isEdit
      ? await fetch(`/api/spaces/${editSpace!.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), color, icon: icon || null }),
        })
      : await fetch('/api/spaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), color, icon: icon || null, parent_id: parentId || null }),
        });
    setSaving(false);
    if (res.ok) {
      onCreated();
      onClose();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || `Failed to ${isEdit ? 'update' : 'create'} space.`);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose} />
      <div
        className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-[420px] bg-bg-base rounded-[14px] border border-border-default p-6"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-serif text-[18px] text-text-primary" style={{ letterSpacing: '-0.02em' }}>
            {isEdit ? 'Edit space' : parentName ? `New space in ${parentName}` : 'New space'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface hover:text-text-secondary transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">Space name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Work, Personal, Design…"
              autoFocus
              className="w-full h-11 px-3.5 rounded-[10px] border border-border-medium text-[14px] text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors placeholder:text-text-faint"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-2">Color</label>
            <div className="flex items-center gap-2 flex-wrap">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-120"
                  style={{
                    background: c,
                    outline: color === c ? `2.5px solid ${c}` : '2.5px solid transparent',
                    outlineOffset: '2px',
                  }}
                >
                  {color === c && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m20 6-11 11-5-5"/>
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Icon (emoji) */}
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-2">Icon (optional)</label>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setIcon('')}
                className={`w-8 h-8 rounded-lg text-[11px] text-text-muted border transition-colors ${
                  !icon ? 'border-accent-blue bg-accent-blue-bg' : 'border-border-medium hover:bg-bg-surface'
                }`}
              >
                none
              </button>
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setIcon(e)}
                  className={`w-8 h-8 rounded-lg text-[18px] border transition-colors ${
                    icon === e ? 'border-accent-blue bg-accent-blue-bg' : 'border-border-light hover:bg-bg-surface'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-2 p-3 bg-bg-surface rounded-[10px]">
            <span className="text-[14px]">{icon}</span>
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-[13px] text-text-primary font-medium">{name || 'Space name'}</span>
          </div>

          {error && <p className="text-[12px] text-danger">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-[10px] border border-border-medium text-[14px] text-text-secondary hover:bg-bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 h-11 rounded-[10px] bg-accent-slate text-white text-[14px] font-medium hover:bg-accent-slate-dark transition-colors disabled:opacity-60"
            >
              {saving ? (isEdit ? 'Saving…' : 'Creating…') : isEdit ? 'Save changes' : 'Create space'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
