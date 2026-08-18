'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { addDays } from 'date-fns';
import { toISODate, todayISO } from '@/lib/todos';
import { CalendarIcon, ClockIcon } from './icons';
import { useTodos } from './TodoProvider';

/**
 * The mobile quick-add bottom sheet.
 *
 * A sheet rather than the desktop bar because the keyboard takes the bottom
 * half of a phone: a field anchored to the top of the page would sit behind
 * it. Every option chip is at least 44px tall — the whole point of the sheet
 * is that a to-do can be filed one-handed without opening the detail screen.
 */
export function MobileQuickAddSheet({ onClose }: { onClose: () => void }) {
  const { createTodo, prefs } = useTodos();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<string | null>(
    prefs.assignment === 'today' ? todayISO() : null
  );
  const [time, setTime] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function save() {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const created = await createTodo({
      title: trimmed,
      description: description.trim() || null,
      due_date: date,
      due_time: time,
      estimate_minutes: estimate,
    });
    setSaving(false);
    if (created) onClose();
  }

  if (typeof document === 'undefined') return null;

  const today = todayISO();
  const tomorrow = toISODate(addDays(new Date(), 1));

  return createPortal(
    <div className="fixed inset-0 z-[130] flex flex-col justify-end">
      <div
        className="absolute inset-0 animate-fadeIn"
        style={{ background: 'var(--scrim)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label="Add a to-do"
        aria-modal="true"
        className="relative bg-bg-base rounded-t-[18px] shadow-modal px-[18px] pt-2.5 pb-5 flex flex-col gap-4 animate-fadeUp max-h-[85vh] overflow-y-auto overscroll-none"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
      >
        <span
          className="self-center w-9 h-1 rounded-full bg-border-medium flex-shrink-0"
          aria-hidden="true"
        />

        <input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              save();
            }
          }}
          placeholder="What needs doing?"
          aria-label="Title"
          className="bg-transparent border-none border-b-[1.5px] border-b-accent-blue outline-none pb-3 text-[16.5px] text-text-primary placeholder:text-text-faint"
          style={{ borderBottomWidth: '1.5px', borderBottomStyle: 'solid', borderBottomColor: 'var(--accent-blue)' }}
        />

        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a short description…"
          aria-label="Description"
          className="bg-transparent border-none outline-none text-13 text-text-secondary placeholder:text-text-faint"
        />

        <div className="flex gap-[7px] flex-wrap">
          <Chip active={date === today} onClick={() => setDate(date === today ? null : today)}>
            Today
          </Chip>
          <Chip active={date === tomorrow} onClick={() => setDate(date === tomorrow ? null : tomorrow)}>
            Tomorrow
          </Chip>
          <label className="inline-flex items-center gap-1.5 text-12.5 text-text-secondary border border-border-default rounded-[9px] px-3.5 min-h-[44px] cursor-pointer">
            <CalendarIcon size={13} />
            <input
              type="date"
              value={date && date !== today && date !== tomorrow ? date : ''}
              onChange={(e) => setDate(e.target.value || null)}
              aria-label="Pick a date"
              className="bg-transparent outline-none text-12.5 w-[110px]"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 text-12.5 text-text-secondary border border-border-default rounded-[9px] px-3.5 min-h-[44px] cursor-pointer">
            <ClockIcon size={13} />
            <input
              type="time"
              value={time ?? ''}
              onChange={(e) => setTime(e.target.value || null)}
              aria-label="Pick a time"
              className="bg-transparent outline-none text-12.5 w-[74px]"
            />
          </label>
          {[15, 30, 60].map((minutes) => (
            <Chip
              key={minutes}
              active={estimate === minutes}
              onClick={() => setEstimate(estimate === minutes ? null : minutes)}
            >
              ~{minutes < 60 ? `${minutes}m` : '1h'}
            </Chip>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-11.5 text-text-muted leading-[1.5]">
            Only the title is needed.
            <br />
            Everything else can wait.
          </span>
          <button
            type="button"
            onClick={save}
            disabled={!title.trim() || saving}
            className="ml-auto text-13.5 text-accent-ink bg-accent-blue rounded-widget px-[26px] py-3 shadow-fab disabled:opacity-50 transition-opacity duration-120"
            style={{ fontWeight: 580 }}
          >
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-12.5 rounded-[9px] px-3.5 min-h-[44px] transition-colors duration-120 ${
        active
          ? 'bg-accent-blue text-accent-ink font-medium'
          : 'text-text-secondary border border-border-default'
      }`}
    >
      {children}
    </button>
  );
}
