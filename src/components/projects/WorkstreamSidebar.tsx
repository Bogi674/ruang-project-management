'use client';

import { Workstream, ProjectEntry } from '@/types';

interface Props {
  workstreams: Workstream[];
  entries: ProjectEntry[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onAddWorkstream: () => void;
}

export function WorkstreamSidebar({ workstreams, entries, activeId, onSelect, onAddWorkstream }: Props) {
  function entryCount(wsId: string) {
    return entries.filter((e) => e.workstream_id === wsId).length;
  }

  return (
    <aside
      style={{ width: 240, flexShrink: 0, background: 'var(--bg-subtle)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
    >
      {/* Section label */}
      <div style={{ padding: '16px 16px 8px', fontSize: 9.5, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500, color: '#b0bcc8' }}>
        Workstreams
      </div>

      {/* "All" row */}
      <button
        onClick={() => onSelect(null)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 8px 16px',
          background: activeId === null ? 'var(--accent-blue-bg)' : 'transparent',
          border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
          borderRadius: 0, transition: 'background 0.1s',
        }}
        onMouseEnter={(e) => { if (activeId !== null) (e.currentTarget as HTMLElement).style.background = '#f0f4f8'; }}
        onMouseLeave={(e) => { if (activeId !== null) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
      >
        <span style={{ width: 3, height: 16, borderRadius: 2, background: 'var(--accent-blue)', flexShrink: 0 }} />
        <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', fontWeight: activeId === null ? 500 : 400 }}>All</span>
        <span style={{ fontSize: 11, color: 'var(--text-faint)', background: 'var(--bg-elevated)', borderRadius: 4, padding: '1px 6px' }}>
          {entries.length}
        </span>
      </button>

      {/* Workstream rows */}
      {workstreams.map((ws) => {
        const active = activeId === ws.id;
        const count = entryCount(ws.id);
        return (
          <button
            key={ws.id}
            onClick={() => onSelect(ws.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 8px 16px',
              background: active ? 'var(--accent-blue-bg)' : 'transparent',
              border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
              borderRadius: 0, transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = '#f0f4f8'; }}
            onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {/* Left accent strip in workstream color — dynamic user data */}
            <span style={{ width: 3, height: 16, borderRadius: 2, background: ws.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary)', fontWeight: active ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ws.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-faint)', background: 'var(--bg-elevated)', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
              {count}
            </span>
          </button>
        );
      })}

      {/* Add workstream */}
      <button
        onClick={onAddWorkstream}
        style={{ margin: '8px 12px 16px', padding: '6px 10px', borderRadius: 7, border: '1px dashed var(--border-medium)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.1s, color 0.1s' }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = 'var(--accent-blue)';
          el.style.color = 'var(--accent-blue-dark)';
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = 'var(--border-medium)';
          el.style.color = 'var(--text-secondary)';
        }}
      >
        + Add workstream
      </button>
    </aside>
  );
}
