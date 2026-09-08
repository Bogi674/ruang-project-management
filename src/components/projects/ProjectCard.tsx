'use client';

import Link from 'next/link';
import { Project } from '@/types';
import { ProjectStatusPill } from './ProjectStatusPill';

interface Props {
  project: Project;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ProjectCard({ project }: Props) {
  const start = formatDate(project.start_date);
  const end = formatDate(project.end_date);
  const dateRange = start && end ? `${start} – ${end}` : start || end || null;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="no-underline block"
      style={{ borderRadius: 12, border: '1px solid var(--border-default)', background: 'var(--bg-base)', overflow: 'hidden', transition: 'box-shadow 0.15s, transform 0.15s', cursor: 'pointer' }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = '0 6px 20px rgba(44,56,72,.09)';
        el.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = '';
        el.style.transform = '';
      }}
    >
      {/* Top accent strip — color is project data so inline is the exception */}
      <div style={{ height: 4, background: project.color, borderRadius: '12px 12px 0 0' }} />

      <div style={{ padding: '14px 18px 16px' }}>
        {/* Name */}
        <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
          {project.name}
        </div>

        {/* Status pill */}
        <div style={{ marginBottom: 8 }}>
          <ProjectStatusPill status={project.status} />
        </div>

        {/* Description */}
        {project.description && (
          <p
            style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {project.description}
          </p>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border-light)', margin: '8px 0' }} />

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
            {project.workstream_count ?? 0} workstream{project.workstream_count !== 1 ? 's' : ''}
          </span>
          {dateRange && (
            <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{dateRange}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
