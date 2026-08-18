'use client';

import { useState } from 'react';
import { addDays, addMonths, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns';
import { formatTime, fromISODate, toISODate, todayISO } from '@/lib/todos';
import { AnchoredPanel, ChipGroup, PanelLabel } from '../AnchoredPanel';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

/**
 * Deadline popover.
 *
 * Date and time are set independently and either may be null — "Wednesday"
 * with no time is the common case, and a to-do that demands a clock time to
 * accept a day is a to-do that gets a made-up one.
 */
export function DeadlinePopover({
  anchorRef,
  onClose,
  date,
  time,
  onChange,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  date: string | null;
  time: string | null;
  onChange: (next: { due_date?: string | null; due_time?: string | null }) => void;
}) {
  const today = todayISO();
  const [cursor, setCursor] = useState(() => startOfMonth(date ? fromISODate(date) : new Date()));
  const [timeDraft, setTimeDraft] = useState(formatTime(time) ?? '');

  const quick: { value: string | null; label: string }[] = [
    { value: today, label: 'Today' },
    { value: toISODate(addDays(new Date(), 1)), label: 'Tomorrow' },
    { value: toISODate(nextSaturday()), label: 'Weekend' },
    { value: toISODate(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), 7)), label: 'Next week' },
    { value: null, label: 'No date' },
  ];

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  // Monday-first, matching the calendar grid and weekRange().
  const leadingBlanks = (monthStart.getDay() + 6) % 7;
  const days = Array.from({ length: monthEnd.getDate() }, (_, i) => i + 1);

  return (
    <AnchoredPanel
      anchorRef={anchorRef}
      onClose={onClose}
      width={300}
      estimatedHeight={400}
      label="Set a deadline"
      className="p-4 flex flex-col gap-3"
    >
      <PanelLabel>Deadline</PanelLabel>

      <ChipGroup
        name="Quick dates"
        value={date}
        options={quick}
        onChange={(next) => onChange({ due_date: next })}
      />

      <div className="flex items-center gap-2">
        <span className="flex-1 text-12.5 text-text-primary" style={{ fontWeight: 580 }}>
          {format(cursor, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={() => setCursor(addMonths(cursor, -1))}
          aria-label="Previous month"
          className="text-text-muted hover:text-text-secondary transition-colors duration-120"
        >
          <ChevronLeftIcon size={13} />
        </button>
        <button
          type="button"
          onClick={() => setCursor(addMonths(cursor, 1))}
          aria-label="Next month"
          className="text-text-muted hover:text-text-secondary transition-colors duration-120"
        >
          <ChevronRightIcon size={13} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
          <span
            key={i}
            className="text-center font-mono text-[9px] text-text-faint pb-1"
            aria-hidden="true"
          >
            {day}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const iso = toISODate(new Date(cursor.getFullYear(), cursor.getMonth(), day));
          const selected = iso === date;
          const isToday = iso === today;
          const past = iso < today;
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onChange({ due_date: iso })}
              aria-current={isToday ? 'date' : undefined}
              className={`text-center text-11.5 rounded-[7px] py-1.5 transition-colors duration-120 ${
                selected
                  ? 'bg-accent-blue text-accent-ink font-semibold'
                  : isToday
                  ? 'text-accent-blue-dark font-semibold ring-1 ring-accent-blue'
                  : past
                  ? 'text-text-faint hover:bg-bg-surface'
                  : 'text-text-secondary hover:bg-bg-surface'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2.5 border-t border-border-light pt-3">
        <label htmlFor="todo-due-time" className="flex-1 text-12 text-text-secondary">
          Time
        </label>
        <input
          id="todo-due-time"
          type="time"
          value={timeDraft}
          onChange={(e) => {
            setTimeDraft(e.target.value);
            onChange({ due_time: e.target.value || null });
          }}
          className="border border-border-default rounded-btn px-2.5 py-1.5 text-12.5 text-text-primary bg-bg-base"
        />
        <span className="text-11 text-text-faint">optional</span>
      </div>
    </AnchoredPanel>
  );
}

/** The coming Saturday — today included only if today is Saturday. */
function nextSaturday(): Date {
  const now = new Date();
  const delta = (6 - now.getDay() + 7) % 7;
  return addDays(now, delta);
}
