'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseQuickAdd, todayISO, type ParsedQuickAdd } from '@/lib/todos';
import { useTodoActions } from './TodoProvider';
import { CloseIcon, PlusIcon } from './icons';

interface QuickAddProps {
  /**
   * The date a to-do created here lands on. `undefined` means "let the user's
   * setting decide"; `null` means explicitly undated (the Anytime column);
   * a date string pre-dates it (an inline row inside a date group).
   */
  dueDate?: string | null;
  spaceId?: string | null;
  placeholder?: string;
  /** `bar` is the bordered sticky field; `inline` is the dashed row inside a group. */
  variant?: 'bar' | 'inline';
  /** Shows the mono `N` keycap. Only the page-level bar has the shortcut. */
  showShortcut?: boolean;
  autoFocus?: boolean;
  onCreated?: () => void;
}

/**
 * Quick add.
 *
 * The only required field is the title. Everything else is either typed inline
 * ("fri 3pm", "~20m") and echoed back as a dismissible chip, or left for
 * later — a form that asks for a date before it will accept a thought is a
 * form that does not get used.
 *
 * `Enter` saves and stays open for the next one, because capture comes in
 * bursts; `Esc` clears and closes.
 */
export function QuickAdd({
  dueDate,
  spaceId = null,
  placeholder = 'Add a to-do — type “fri 3pm” or “~20m” and it fills itself in',
  variant = 'bar',
  showShortcut = false,
  autoFocus = false,
  onCreated,
}: QuickAddProps) {
  const { createTodo, prefs } = useTodoActions();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  /** Chips the user dismissed, so a wrong guess costs one click, not a re-type. */
  const [dismissed, setDismissed] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const parsed: ParsedQuickAdd = useMemo(() => parseQuickAdd(value), [value]);
  const chips = parsed.matches.filter((m) => !dismissed.includes(m.kind));

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // A dismissal only applies to the text that was on screen when it happened;
  // typing a different date afterwards should offer the new chip.
  useEffect(() => {
    setDismissed([]);
  }, [parsed.matches.map((m) => `${m.kind}:${m.text}`).join('|')]);

  async function submit() {
    const title = parsed.title.trim() || value.trim();
    if (!title || saving) return;

    const use = (kind: 'date' | 'time' | 'estimate') =>
      parsed.matches.some((m) => m.kind === kind) && !dismissed.includes(kind);

    // Explicit `null` (the Anytime column) is honoured; `undefined` falls
    // back to the user's "new to-dos land on" setting.
    const resolvedDate = use('date')
      ? parsed.due_date
      : dueDate !== undefined
      ? dueDate
      : prefs.assignment === 'today'
      ? todayISO()
      : null;

    // A time only when one was typed. Nothing here invents one — see the note
    // in lib/todos.ts about why the end-of-day default was rolled back.
    const resolvedTime = use('time') ? parsed.due_time : null;

    setSaving(true);
    const created = await createTodo({
      title,
      due_date: resolvedDate,
      due_time: resolvedTime,
      estimate_minutes: use('estimate') ? parsed.estimate_minutes : null,
      space_id: spaceId,
    });
    setSaving(false);

    if (created) {
      setValue('');
      setDismissed([]);
      onCreated?.();
      inputRef.current?.focus();
    }
  }

  const isInline = variant === 'inline';

  return (
    <div
      className={
        isInline
          ? 'rounded-card border border-dashed border-border-medium px-[15px] py-[11px]'
          : 'bg-bg-base border-[1.5px] border-dashed border-border-medium rounded-card px-4 py-[13px]'
      }
    >
      <div className="flex items-center gap-3">
        <PlusIcon
          size={isInline ? 14 : 17}
          className={isInline ? 'text-text-faint flex-shrink-0' : 'text-accent-blue flex-shrink-0'}
        />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
            if (e.key === 'Escape') {
              setValue('');
              inputRef.current?.blur();
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          disabled={saving}
          className={`flex-1 min-w-0 bg-transparent border-none outline-none text-text-primary placeholder:text-text-muted disabled:opacity-60 ${
            isInline ? 'text-13' : 'text-13.5'
          }`}
        />
        {showShortcut && !value && (
          <span className="font-mono text-10 text-text-faint border border-border-default rounded-[5px] px-1.5 py-[3px] flex-shrink-0">
            N
          </span>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-2.5 pl-[29px]">
          {chips.map((chip) => (
            <button
              key={chip.kind}
              type="button"
              onClick={() => setDismissed((d) => [...d, chip.kind])}
              title={`Ignore “${chip.text}” and keep it in the title`}
              className="inline-flex items-center gap-1.5 text-11 text-accent-blue-dark bg-accent-blue-bg rounded-[5px] pl-2 pr-1.5 py-[3px] hover:opacity-80 transition-opacity duration-120"
            >
              {chip.label}
              <CloseIcon size={9} strokeWidth={2.2} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The "+" at the end of an empty day's single line.
 *
 * The same thing InlineAddRow does, at the size an empty day can afford in the
 * Month view: collapsed to an icon until it is used, then the full inline
 * field. Keeping it on every empty day is what makes "add this to Saturday" a
 * click on Saturday rather than a trip through a date picker.
 */
export function QuietAddButton({
  dueDate,
  label,
  spaceId,
}: {
  dueDate: string | null;
  label: string;
  spaceId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="flex-[3] min-w-0">
        <QuickAdd
          variant="inline"
          dueDate={dueDate}
          spaceId={spaceId}
          placeholder={label}
          autoFocus
          onCreated={() => setOpen(false)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={label}
      title={label}
      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-btn text-text-faint hover:text-accent-blue-dark hover:bg-accent-blue-bg transition-colors duration-120"
    >
      <PlusIcon size={12} />
    </button>
  );
}

/**
 * The dashed "Add to Tuesday 18" row that closes every date group.
 *
 * Collapsed to a button until it is used: a text field inside every group,
 * always visible, turns a list of six days into a list of twelve rows.
 */
export function InlineAddRow({
  dueDate,
  label,
  spaceId,
}: {
  dueDate: string | null;
  label: string;
  spaceId?: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 w-full rounded-card border border-dashed border-border-medium px-[15px] py-[11px] text-13 text-text-secondary hover:text-accent-blue-dark hover:border-accent-blue hover:bg-accent-blue-bg transition-colors duration-120"
      >
        <PlusIcon size={14} className="text-text-muted" />
        {label}
      </button>
    );
  }

  return (
    <QuickAdd
      variant="inline"
      dueDate={dueDate}
      spaceId={spaceId}
      placeholder={label}
      autoFocus
      onCreated={() => {
        /* stays open — adding one item to a day usually means adding two */
      }}
    />
  );
}
