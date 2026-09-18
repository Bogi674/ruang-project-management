'use client';

import { Project } from '@/types';
import { ProjectStatusPill } from './ProjectStatusPill';

type ViewType = 'list' | 'timeline' | 'kanban';

interface Props {
  project: Project;
  view: ViewType;
  onViewChange: (v: ViewType) => void;
  onAddEntry: () => void;
}

const VIEWS: { value: ViewType; label: string }[] = [
  { value: 'list',     label: 'List' },
  { value: 'timeline', label: 'Timeline' },
  { value: 'kanban',   label: 'Kanban' },
];

export function ProjectSubHeader({ project, view, onViewChange, onAddEntry }: Props) {
  return (
    <div
      style={{ height: 52, background: 'var(--bg-base)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, flexShrink: 0 }}
    >
      {/* Left: color dot + name + status pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        {/* Project color dot — inline because it is dynamic user data */}
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: project.color, flexShrink: 0 }} />
        <span style={{ fontSize: 16, fontWeight: 580, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.name}
        </span>
        <ProjectStatusPill status={project.status} />
      </div>

      {/* Center: view toggle */}
      <div
        style={{ display: 'flex', border: '1px solid var(--border-default)', borderRadius: 7, padding: 3, background: 'var(--bg-subtle)', gap: 2, flexShrink: 0 }}
      >
        {VIEWS.map((v) => (
          <button
            key={v.value}
            onClick={() => onViewChange(v.value)}
            style={{
              padding: '3px 12px',
              borderRadius: 6,
              border: view === v.value ? '1px solid var(--accent-blue)' : '1px solid transparent',
              background: view === v.value ? 'var(--accent-blue-bg)' : 'transparent',
              color: view === v.value ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.1s, color 0.1s',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Right: add entry + overflow */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <button
          onClick={onAddEntry}
          style={{ padding: '6px 14px', borderRadius: 7, border: '1px solid var(--border-medium)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', transition: 'border-color 0.1s, color 0.1s' }}
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
          Add entry
        </button>
      </div>
    </div>
  );
}
