'use client';

import { formatDueLabel, formatEstimate, formatTime } from '@/lib/todos';
import type { Todo, TodoRecurrence } from '@/types';
import { BellIcon, ClockIcon, PaperclipIcon, NoteIcon, RepeatIcon } from './icons';

/** Human wording for a reminder lead, matching REMINDER_LEAD_OPTIONS. */
const LEAD_LABELS: Record<string, string> = {
  '15m': '15 min before',
  '30m': '30 min before',
  '1h': '1 h before',
  '3h': '3 h before',
  '1d': '1 day before',
  '3d': '3 days before',
  '1w': '1 week before',
};

export function reminderLabel(lead: string): string {
  return LEAD_LABELS[lead] ?? lead;
}

export function recurrenceLabel(recurrence: TodoRecurrence): string {
  const every = recurrence.interval > 1 ? `Every ${recurrence.interval} ` : '';
  if (recurrence.freq === 'daily') return every ? `${every}days` : 'Daily';
  if (recurrence.freq === 'weekly') return every ? `${every}weeks` : 'Weekly';
  if (recurrence.freq === 'monthly') return every ? `${every}months` : 'Monthly';
  return 'Custom';
}

/** Time chip — accent-tinted, because a time is the strongest signal on a row. */
export function TimeChip({ time }: { time: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-11 text-accent-blue-dark bg-accent-blue-bg rounded-[5px] px-[7px] py-[2px]">
      <ClockIcon size={11} />
      {formatTime(time)}
    </span>
  );
}

/** Estimate chip — mono and outlined, so it reads as a measurement, not a label. */
export function EstimateChip({ minutes }: { minutes: number }) {
  return (
    <span className="font-mono text-10 text-text-secondary border border-border-default rounded-[5px] px-1.5 py-[2px]">
      {formatEstimate(minutes)}
    </span>
  );
}

/**
 * Overdue chip.
 *
 * Amber, never red — `--danger` is reserved for destructive actions. Being
 * late is not an error, and painting it like one is what makes a list of
 * slipped to-dos feel like a telling-off rather than a state of affairs.
 */
export function OverdueChip({ dueDate, today }: { dueDate: string; today: string }) {
  return (
    <span
      className="text-11 text-accent-amber-dark bg-accent-amber-bg rounded-[5px] px-[7px] py-[2px]"
      style={{ border: '1px solid var(--chip-note-border)' }}
    >
      {formatDueLabel(dueDate, today)}
    </span>
  );
}

export function ReminderChip({ lead }: { lead: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-11 text-text-muted">
      <BellIcon size={11} />
      {reminderLabel(lead)}
    </span>
  );
}

export function RepeatChip({ recurrence }: { recurrence: TodoRecurrence }) {
  return (
    <span className="inline-flex items-center gap-1 text-11 text-text-muted">
      <RepeatIcon size={11} />
      {recurrenceLabel(recurrence)}
    </span>
  );
}

/** Space dot + name. The dot colour is user data — the documented exception to rule 9. */
export function SpaceChip({ color, name }: { color: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-[5px] text-11 text-text-secondary">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      {name}
    </span>
  );
}

/** Sub-task progress: a 64×4 bar plus "2 of 3". */
export function SubtaskProgress({ done, total }: { done: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-[7px]">
      <span className="w-16 h-1 rounded-full bg-bg-elevated overflow-hidden">
        <span
          className="block h-full rounded-full bg-accent-green-mid transition-all duration-220"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </span>
      <span className="font-mono text-[9.5px] text-text-faint">
        {done} of {total}
      </span>
    </span>
  );
}

/** Attachment chips under the title — the file name or the linked note's title. */
export function AttachmentChips({ todo }: { todo: Todo }) {
  const attachments = todo.attachments || [];
  if (attachments.length === 0) return null;

  return (
    <>
      {attachments.map((attachment) => {
        const isNote = attachment.kind === 'note';
        const label = isNote
          ? attachment.note?.title || 'Untitled note'
          : attachment.file?.filename || 'File';
        return (
          <span
            key={attachment.id}
            className="inline-flex items-center gap-[5px] max-w-[220px] text-11 text-text-secondary border border-border-default rounded-md px-2 py-[3px]"
            title={label}
          >
            {isNote ? <NoteIcon size={11} /> : <PaperclipIcon size={11} />}
            <span className="truncate">{label}</span>
          </span>
        );
      })}
    </>
  );
}
