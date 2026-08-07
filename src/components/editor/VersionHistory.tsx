'use client';

import { useState, useEffect } from 'react';
import { NoteVersion } from '@/types';

interface VersionHistoryProps {
  noteId: string;
  onRestore: (content: object) => void;
  onClose: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function VersionHistory({ noteId, onRestore, onClose }: VersionHistoryProps) {
  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/notes/${noteId}/versions`)
      .then((r) => r.json())
      .then((data) => { setVersions(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [noteId]);

  async function handleRestore(v: NoteVersion) {
    setRestoring(v.id);
    onRestore(v.content);
    setRestoring(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end"
      style={{ background: 'rgba(44,56,72,0.18)', backdropFilter: 'blur(1px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="h-full w-[320px] bg-bg-base border-l border-border-default flex flex-col animate-fadeUp"
        style={{ boxShadow: '-4px 0 24px rgba(44,56,72,0.08)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light flex-shrink-0">
          <h3 className="font-serif text-[16px] text-text-primary" style={{ letterSpacing: '-0.02em' }}>
            Version history
          </h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:bg-bg-surface transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3">
          {loading && (
            <div className="flex items-center justify-center h-32">
              <div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && versions.length === 0 && (
            <div className="px-5 py-8 text-center">
              <p className="text-13 text-text-muted">No saved versions yet.</p>
              <p className="text-12 text-text-faint mt-1">Use "Save version" to create a checkpoint.</p>
            </div>
          )}

          {!loading && versions.map((v, i) => (
            <div key={v.id} className="px-5 py-3 border-b border-border-light last:border-0 hover:bg-bg-surface transition-colors group">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {i === 0 && (
                    <span className="inline-block text-[10px] font-mono font-semibold uppercase tracking-widest text-accent-blue-dark bg-accent-blue-bg px-1.5 py-0.5 rounded mb-1">
                      Latest
                    </span>
                  )}
                  <p className="text-13 text-text-primary truncate">{v.title || 'Untitled'}</p>
                  <p className="text-11 text-text-faint mt-0.5">{formatDate(v.created_at)}</p>
                </div>
                <button
                  onClick={() => handleRestore(v)}
                  disabled={restoring === v.id}
                  className="opacity-0 group-hover:opacity-100 text-12 text-text-secondary border border-border-medium rounded-lg px-2.5 py-1 hover:bg-bg-subtle transition-all duration-120 flex-shrink-0"
                >
                  {restoring === v.id ? '…' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-border-light flex-shrink-0">
          <p className="text-11 text-text-faint">Versions are kept for up to 20 checkpoints.</p>
        </div>
      </div>
    </div>
  );
}
