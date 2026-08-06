'use client';

import { ReminderContent } from '@/types';

interface ReminderWidgetProps {
  content: ReminderContent;
  onRemove?: () => void;
}

export function ReminderWidget({ content, onRemove }: ReminderWidgetProps) {
  const datetime = content.date
    ? `${content.date}${content.time ? ` at ${content.time}` : ''}`
    : 'No date set';

  return (
    <div className="flex items-center gap-3 p-3.5 bg-bg-surface border border-border-default rounded-widget">
      <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#738290" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-13 font-medium text-text-primary truncate">{content.title || 'Reminder'}</p>
        <p className="text-11 text-text-muted mt-0.5">{datetime} · {content.type_label}</p>
      </div>
      {onRemove && (
        <button onClick={onRemove} className="text-11 text-text-muted border border-border-default rounded-full px-2.5 py-1 hover:text-danger hover:border-danger-border transition-colors duration-120">
          Remove
        </button>
      )}
    </div>
  );
}
