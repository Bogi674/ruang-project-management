'use client';

import { ReminderContent, REMINDER_LEAD_OPTIONS } from '@/types';
import { WidgetRow } from './WidgetRow';

interface ReminderWidgetProps {
  content: ReminderContent;
  highlight?: boolean;
  onRemove?: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-08-20" -> "Aug 20, 2026" without dragging a date lib into the row. */
function formatDate(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

export function buildReminderSubtitle(content: ReminderContent): string {
  const parts: string[] = [];
  parts.push(
    content.date
      ? `${formatDate(content.date)}${content.time ? ` at ${content.time}` : ''}`
      : 'No date set'
  );
  if (content.type_label) parts.push(content.type_label);

  // Delivery detail only reads as useful once there is somebody to send to.
  const times = content.send_times ?? 0;
  if (times > 0 && content.recipients?.length) {
    const lead = REMINDER_LEAD_OPTIONS.find((o) => o.value === content.send_early)?.label;
    parts.push(lead ? `${times}× (${lead})` : `${times}×`);
  }
  return parts.join(' · ');
}

export function ReminderWidget({ content, highlight, onRemove }: ReminderWidgetProps) {
  return (
    <WidgetRow
      type="reminder"
      title={content.title || 'Reminder'}
      subtitle={buildReminderSubtitle(content)}
      highlight={highlight}
      onRemove={onRemove}
    />
  );
}
