'use client';

import { REMINDER_LEAD_OPTIONS, type ReminderLead, type TodoReminder } from '@/types';
import { AnchoredPanel, ChipGroup, PanelLabel } from '../AnchoredPanel';
import { CheckIcon } from '../icons';

/** The three the design surfaces; the rest live behind "Custom". */
const PRIMARY: { lead: ReminderLead; label: string }[] = [
  { lead: '15m', label: "When it's due" },
  { lead: '1h', label: '1 hour before' },
  { lead: '1d', label: '1 day before' },
];

/**
 * Reminder popover.
 *
 * `lead` reuses the `ReminderLead` vocabulary the reminder widget already
 * stores and the Resend pipeline already understands, so a to-do reminder is
 * deliverable by the same worker rather than a second parallel notion of
 * "how early".
 */
export function ReminderPopover({
  anchorRef,
  onClose,
  reminder,
  onChange,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
  reminder: TodoReminder | null;
  onChange: (next: TodoReminder | null) => void;
}) {
  const custom = reminder && !PRIMARY.some((p) => p.lead === reminder.lead);

  function setLead(lead: ReminderLead) {
    onChange({ lead, repeat_count: reminder?.repeat_count ?? 1 });
  }

  return (
    <AnchoredPanel
      anchorRef={anchorRef}
      onClose={onClose}
      width={300}
      estimatedHeight={330}
      label="Set a reminder"
      className="p-4 flex flex-col gap-[9px]"
    >
      <PanelLabel>Reminder</PanelLabel>

      {PRIMARY.map((option) => {
        const selected = reminder?.lead === option.lead;
        return (
          <button
            key={option.lead}
            type="button"
            onClick={() => setLead(option.lead)}
            aria-pressed={selected}
            className={`flex items-center gap-2.5 rounded-[9px] px-[11px] py-2.5 text-12.5 text-text-primary transition-colors duration-120 ${
              selected
                ? 'border-[1.5px] border-accent-blue bg-accent-blue-bg'
                : 'border border-border-default hover:bg-bg-surface'
            }`}
          >
            {option.label}
            {selected && (
              <span className="ml-auto text-accent-blue-dark">
                <CheckIcon size={13} strokeWidth={2.4} />
              </span>
            )}
          </button>
        );
      })}

      <label className="flex items-center gap-2.5 rounded-[9px] border border-border-default px-[11px] py-2.5 text-12.5 text-text-secondary">
        Custom
        <select
          value={custom ? reminder!.lead : ''}
          onChange={(e) => e.target.value && setLead(e.target.value as ReminderLead)}
          className="ml-auto bg-transparent text-text-primary text-12.5 outline-none"
        >
          <option value="">Choose…</option>
          {REMINDER_LEAD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {reminder && (
        <div className="border-t border-border-light pt-[11px] flex flex-col gap-2">
          <span className="text-12 text-text-secondary">Nudge again if it&rsquo;s still open</span>
          <ChipGroup
            name="Repeat the nudge"
            value={reminder.repeat_count}
            options={[
              { value: 1, label: 'Once' },
              { value: 2, label: 'Twice' },
              { value: null, label: 'Until done' },
            ]}
            onChange={(repeat_count) => onChange({ ...reminder, repeat_count })}
          />
          <p className="m-0 text-11 text-text-muted leading-[1.5]">
            Delivered in-app and by email through the existing reminder pipeline.
          </p>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              onClose();
            }}
            className="self-start text-11.5 text-text-muted hover:text-danger transition-colors duration-120"
          >
            Remove the reminder
          </button>
        </div>
      )}
    </AnchoredPanel>
  );
}
