'use client';

import { ProjectStatus } from '@/types';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  todo: 'Not started',
  in_progress: 'In progress',
  on_hold: 'On hold',
  completed: 'Completed',
};

// Colors use CSS custom properties where possible; status-specific fills are inline
const STATUS_STYLES: Record<ProjectStatus, { bg: string; color: string }> = {
  todo:        { bg: '#f4f5f7', color: '#738290' },
  in_progress: { bg: '#dce8f6', color: '#4a6090' },
  on_hold:     { bg: '#fff4ee', color: '#E06830' },
  completed:   { bg: '#E4F0D0', color: '#4a6a40' },
};

interface Props {
  status: ProjectStatus;
}

export function ProjectStatusPill({ status }: Props) {
  const { bg, color } = STATUS_STYLES[status] ?? STATUS_STYLES.todo;
  return (
    <span
      style={{ background: bg, color, height: 20, borderRadius: 10, fontSize: 11, fontWeight: 500, padding: '0 8px', display: 'inline-flex', alignItems: 'center' }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
