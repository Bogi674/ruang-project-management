'use client';

import { useEffect, useRef, useState } from 'react';
import { ReminderContent, ReminderLabel, ReminderLead, REMINDER_LEAD_OPTIONS } from '@/types';
import {
  FieldHint,
  FieldLabel,
  SectionLabel,
  SelectField,
  Stepper,
  TextAreaField,
  TextField,
} from './fields';

const TYPE_LABELS: ReminderLabel[] = ['Deadline', 'Follow-up', 'Meeting', 'Review'];

export interface ReminderFormProps {
  initial?: Partial<ReminderContent>;
  /** Fires on every edit so the modal footer can enable/disable its submit. */
  onChange: (content: ReminderContent, valid: boolean) => void;
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function ReminderForm({ initial, onChange }: ReminderFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(initial?.date ?? '');
  const [time, setTime] = useState(initial?.time ?? '');
  const [typeLabel, setTypeLabel] = useState<ReminderLabel>(initial?.type_label ?? 'Deadline');
  const [recipients, setRecipients] = useState<string[]>(initial?.recipients ?? []);
  const [emailDraft, setEmailDraft] = useState('');
  const [sendTimes, setSendTimes] = useState(initial?.send_times ?? 1);
  const [sendEarly, setSendEarly] = useState<ReminderLead>(initial?.send_early ?? '1h');

  // Keep the callback out of the effect's dependency list — parents commonly
  // pass an inline arrow, which would otherwise re-fire this every render.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    onChangeRef.current(
      {
        title: title.trim(),
        description: description.trim(),
        date: date || null,
        time: time || null,
        recurrence: 'once',
        type_label: typeLabel,
        recipients,
        send_times: sendTimes,
        send_early: sendEarly,
      },
      title.trim().length > 0 && !!date
    );
  }, [title, description, date, time, typeLabel, recipients, sendTimes, sendEarly]);

  function commitEmail() {
    const value = emailDraft.trim().replace(/,$/, '');
    if (isEmail(value) && !recipients.includes(value)) {
      setRecipients((prev) => [...prev, value]);
    }
    if (isEmail(value) || value === '') setEmailDraft('');
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel required>Reminder Name</FieldLabel>
        <TextField
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Design Review"
        />
      </div>

      <div>
        <FieldLabel optional>Description</FieldLabel>
        <TextAreaField
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a note about this reminder…"
        />
      </div>

      <div>
        <FieldLabel required>Date &amp; Time</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          <TextField type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-13" />
          <TextField type="time" value={time} onChange={(e) => setTime(e.target.value)} className="text-13" />
        </div>
      </div>

      <div>
        <FieldLabel>Type</FieldLabel>
        <div className="flex flex-wrap gap-1.5">
          {TYPE_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => setTypeLabel(label)}
              className={`px-3 py-1 rounded-full text-12 font-medium border transition-colors duration-120 ${
                typeLabel === label
                  ? 'bg-accent-blue-bg text-accent-blue-dark border-accent-blue'
                  : 'bg-bg-surface text-text-muted border-border-light hover:border-border-medium'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border-light pt-4">
        <SectionLabel>Email Delivery</SectionLabel>

        <div className="mb-3">
          <FieldLabel>Recipients</FieldLabel>
          <div className="border border-border-medium rounded-btn p-2 bg-bg-base min-h-[42px] flex flex-wrap gap-1.5 items-center focus-within:border-accent-blue transition-colors duration-120">
            {recipients.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 bg-accent-blue-bg text-accent-blue-dark text-12 rounded-full pl-2.5 pr-1.5 py-0.5"
              >
                {email}
                <button
                  type="button"
                  aria-label={`Remove ${email}`}
                  onClick={() => setRecipients((prev) => prev.filter((e) => e !== email))}
                  className="text-[#8ca3c8] hover:text-danger transition-colors duration-120 text-[15px] leading-none"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="email"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  commitEmail();
                } else if (e.key === 'Backspace' && !emailDraft) {
                  setRecipients((prev) => prev.slice(0, -1));
                }
              }}
              onBlur={commitEmail}
              placeholder={recipients.length ? 'Add another…' : 'Add email, press Enter…'}
              className="flex-1 min-w-[130px] border-none outline-none text-13 text-text-primary bg-transparent px-1 py-0.5 placeholder:text-text-muted"
            />
          </div>
          <FieldHint>Press Enter or comma to add each address</FieldHint>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>Send times</FieldLabel>
            <Stepper value={sendTimes} onChange={setSendTimes} min={1} max={10} />
          </div>
          <div>
            <FieldLabel>How early</FieldLabel>
            <SelectField value={sendEarly} onChange={(e) => setSendEarly(e.target.value as ReminderLead)}>
              {REMINDER_LEAD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </SelectField>
          </div>
        </div>
      </div>
    </div>
  );
}
