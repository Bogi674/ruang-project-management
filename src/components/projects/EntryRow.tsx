'use client';

import { ProjectEntry } from '@/types';
import { EntryTypeIcon } from './EntryTypeIcon';
import { EntryStatusPill } from './EntryStatusPill';

interface Props {
  entry: ProjectEntry;
  onDelete?: (id: string) => void;
  onClick?: () => void;
}

function formatDate(d?: string) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function EntryRow({ entry, onDelete, onClick }: Props) {
  const date = formatDate(entry.pinned_date);

  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '6px 16px', borderBottom: '1px solid var(--border-light)', position: 'relative', cursor: onClick ? 'pointer' : undefined }}
      className="entry-row"
    >
      <style>{`.entry-row:hover { background: #f4f8fc; } .entry-row:hover .entry-overflow { opacity: 1; }`}</style>

      <EntryTypeIcon type={entry.type} />

      <span style={{ flex: 1, fontSize: 13.5, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {entry.title || <span style={{ color: 'var(--text-faint)' }}>Untitled</span>}
      </span>

      {entry.type === 'task' && entry.status && (
        <EntryStatusPill status={entry.status} />
      )}

      {date && (
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)', whiteSpace: 'nowrap', marginLeft: 4 }}>{date}</span>
      )}

      {/* Overflow menu — revealed on hover via CSS */}
      <div className="entry-overflow" style={{ opacity: 0, transition: 'opacity 0.1s' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(entry.id); }}
          style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'var(--bg-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
          title="Delete entry"
        >
          ···
        </button>
      </div>
    </div>
  );
}
