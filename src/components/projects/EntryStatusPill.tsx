'use client';

import { EntryStatus } from '@/types';

const STATUS_LABELS: Record<EntryStatus, string> = {
  todo:        'To do',
  in_progress: 'In progress',
  blocked:     'Blocked',
  done:        'Done',
};

const STATUS_STYLES: Record<EntryStatus, { bg: string; color: string }> = {
  todo:        { bg: '#f4f5f7', color: '#738290' },
  in_progress: { bg: '#dce8f6', color: '#4a6090' },
  blocked:     { bg: '#fff4ee', color: '#E06830' },
  done:        { bg: '#E4F0D0', color: '#4a6a40' },
};

interface Props {
  status: EntryStatus;
}

export function EntryStatusPill({ status }: Props) {
  const { bg, color } = STATUS_STYLES[status] ?? STATUS_STYLES.todo;
  return (
    <span
      style={{ background: bg, color, height: 20, borderRadius: 10, fontSize: 11, fontWeight: 500, padding: '0 8px', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
