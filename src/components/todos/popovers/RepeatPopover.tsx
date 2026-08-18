'use client';

import type { RecurrenceFreq, RecurrenceOnMissed, TodoRecurrence } from '@/types';
import { AnchoredPanel, ChipGroup, PanelLabel } from '../AnchoredPanel';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
/** Column order is Monday-first; the stored values are 0 = Sunday. */
const WEEKDAY_VALUES = [1, 2, 3, 4, 5, 6, 0];

/**
 * Repeat popover.
 *
 * The one setting here that is a product decision rather than a control is
 * "if a repeat is missed". It defaults to **skip**: rolling every missed
 * occurrence forward turns one abandoned daily habit into fifty overdue rows,
 * which is precisely the wall this feature exists to avoid.
 */
export function RepeatPopover({
  anchorRef,
  onClose,
  recurrence,
  onChange,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  recurrence: TodoRecurrence | null;
  onChange: (next: TodoRecurrence | null) => void;
}) {
  const current: TodoRecurrence = recurrence ?? {
    freq: 'weekly',
    interval: 1,
    byday: [],
    ends: { type: 'never' },
    on_missed: 'skip',
  };

  function patch(updates: Partial<TodoRecurrence>) {
    onChange({ ...current, ...updates });
  }

  function toggleDay(value: number) {
    const days = current.byday || [];
    patch({ byday: days.includes(value) ? days.filter((d) => d !== value) : [...days, value] });
  }

  return (
    <AnchoredPanel
      anchorRef={anchorRef}
      onClose={onClose}
      width={300}
      estimatedHeight={340}
      label="Set a repeat"
      className="p-4 flex flex-col gap-[9px]"
    >
      <PanelLabel>Repeat</PanelLabel>

      <ChipGroup
        name="How often"
        value={recurrence ? current.freq : ('none' as RecurrenceFreq)}
        options={[
          { value: 'daily' as RecurrenceFreq, label: 'Daily' },
          { value: 'weekly' as RecurrenceFreq, label: 'Weekly' },
          { value: 'monthly' as RecurrenceFreq, label: 'Monthly' },
          { value: 'custom' as RecurrenceFreq, label: 'Custom' },
        ]}
        onChange={(freq) => patch({ freq })}
      />

      {(current.freq === 'weekly' || current.freq === 'custom') && recurrence && (
        <div className="flex gap-1 mt-0.5" role="group" aria-label="Repeat on these days">
          {WEEKDAY_LABELS.map((label, i) => {
            const value = WEEKDAY_VALUES[i];
            const on = (current.byday || []).includes(value);
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(value)}
                aria-pressed={on}
                aria-label={
                  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i]
                }
                className={`flex-1 text-center text-11 rounded-[7px] py-1.5 transition-colors duration-120 ${
                  on
                    ? 'bg-accent-blue text-accent-ink font-semibold'
                    : 'text-text-secondary border border-border-default hover:bg-bg-surface'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {recurrence && (
        <>
          <div className="flex items-center gap-2.5 border border-border-default rounded-[9px] px-[11px] py-2.5 text-12.5 text-text-primary">
            <label htmlFor="repeat-ends" className="flex-1">
              Ends
            </label>
            <select
              id="repeat-ends"
              value={current.ends?.type ?? 'never'}
              onChange={(e) =>
                patch({ ends: { type: e.target.value as 'never' | 'on' | 'after' } })
              }
              className="bg-transparent text-text-secondary outline-none"
            >
              <option value="never">Never</option>
              <option value="on">On a date</option>
              <option value="after">After N times</option>
            </select>
          </div>

          {current.ends?.type === 'on' && (
            <input
              type="date"
              value={current.ends.date ?? ''}
              onChange={(e) => patch({ ends: { type: 'on', date: e.target.value || null } })}
              aria-label="Repeat until"
              className="border border-border-default rounded-[9px] px-[11px] py-2.5 text-12.5 text-text-primary bg-bg-base"
            />
          )}

          {current.ends?.type === 'after' && (
            <input
              type="number"
              min={1}
              value={current.ends.count ?? 1}
              onChange={(e) =>
                patch({ ends: { type: 'after', count: Math.max(1, Number(e.target.value)) } })
              }
              aria-label="Number of repeats"
              className="border border-border-default rounded-[9px] px-[11px] py-2.5 text-12.5 text-text-primary bg-bg-base"
            />
          )}

          <div className="border-t border-border-light pt-[11px] flex flex-col gap-2">
            <span className="text-12 text-text-secondary">If a repeat is missed</span>
            <ChipGroup
              name="Missed repeats"
              value={current.on_missed}
              options={[
                { value: 'skip' as RecurrenceOnMissed, label: 'Skip it quietly' },
                { value: 'rollover' as RecurrenceOnMissed, label: 'Roll it over' },
              ]}
              onChange={(on_missed) => patch({ on_missed })}
            />
            <p className="m-0 text-11 text-text-muted leading-[1.5]">
              Skipping stops missed repeats from stacking into a wall of overdue.
            </p>
            <button
              type="button"
              onClick={() => {
                onChange(null);
                onClose();
              }}
              className="self-start text-11.5 text-text-muted hover:text-danger transition-colors duration-120"
            >
              Stop repeating
            </button>
          </div>
        </>
      )}
    </AnchoredPanel>
  );
}
