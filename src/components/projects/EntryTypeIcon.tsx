'use client';

import { EntryType } from '@/types';

// Icon wells use status-neutral static fills based on entry type spec
const TYPE_STYLES: Record<EntryType, { bg: string; color: string }> = {
  note:     { bg: '#f4f5f7', color: '#738290' },
  file:     { bg: '#f4f5f7', color: '#738290' },
  task:     { bg: '#dce8f6', color: '#4a6090' },
  reminder: { bg: '#fff4ee', color: '#E06830' },
  link:     { bg: '#f0eeff', color: '#5a40a0' },
};

function NoteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <polyline points="13 2 13 9 20 9"/>
    </svg>
  );
}

function TaskIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function ReminderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  );
}

const ICONS: Record<EntryType, React.ReactNode> = {
  note:     <NoteIcon />,
  file:     <FileIcon />,
  task:     <TaskIcon />,
  reminder: <ReminderIcon />,
  link:     <LinkIcon />,
};

interface Props {
  type: EntryType;
}

export function EntryTypeIcon({ type }: Props) {
  const { bg, color } = TYPE_STYLES[type] ?? TYPE_STYLES.note;
  return (
    <span
      style={{ background: bg, color, width: 20, height: 20, borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
    >
      {ICONS[type]}
    </span>
  );
}
