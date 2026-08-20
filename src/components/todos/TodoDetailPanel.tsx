'use client';

import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useSpaces } from '@/lib/spaces';
import { formatFileSize, formatRelativeTime } from '@/lib/utils';
import { formatDueLabel, formatEstimate, formatTime, isParentLocked, todayISO } from '@/lib/todos';
import type { SubtaskMode, Todo } from '@/types';
import { recurrenceLabel, reminderLabel } from './TodoChips';
import { TodoCheckbox } from './TodoCheckbox';
import {
  BellIcon,
  CalendarIcon,
  CloseIcon,
  ClockIcon,
  NoteIcon,
  OverflowIcon,
  PaperclipIcon,
  PlusIcon,
  RepeatIcon,
} from './icons';
import { DeadlinePopover } from './popovers/DeadlinePopover';
import { ReminderPopover } from './popovers/ReminderPopover';
import { RepeatPopover } from './popovers/RepeatPopover';
import { AttachPopover } from './popovers/AttachPopover';
import { useTodos } from './TodoProvider';

type OpenPopover = 'deadline' | 'reminder' | 'repeat' | 'attach' | null;

/**
 * The task detail panel.
 *
 * A right-hand drawer on desktop and a full screen on mobile — the same
 * component, because the content is identical and only the frame differs.
 * Everything in it saves on change; there is no Save button anywhere in this
 * app and this is not the place to introduce one.
 */
export function TodoDetailPanel() {
  const { todos, openTodoId, setOpenTodoId } = useTodos();

  /*
   * Build the full todo (with subtasks) from the flat todos array.
   *
   * The flat array stores parents and sub-tasks interleaved; `subtasks` is only
   * populated on the hierarchical `groups` structure. The detail panel reads the
   * flat array so it stays current after optimistic mutations without waiting for
   * the groups memo to re-run. Subtasks are filtered here instead.
   */
  const todo = useMemo(() => {
    const parent = todos.find((t) => t.id === openTodoId);
    if (!parent) return null;
    const subtasks = todos.filter((t) => t.parent_id === openTodoId);
    return { ...parent, subtasks };
  }, [todos, openTodoId]);

  useEffect(() => {
    if (!todo) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenTodoId(null);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpenTodoId, todo]);

  if (!todo || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex justify-end">
      <div
        className="absolute inset-0 animate-fadeIn"
        style={{ background: 'var(--scrim)' }}
        onClick={() => setOpenTodoId(null)}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={todo.title}
        aria-modal="true"
        className="relative w-full md:w-[440px] h-full md:h-auto md:max-h-[calc(100vh-32px)] md:m-4 bg-bg-base md:border md:border-border-medium md:rounded-[14px] shadow-modal overflow-y-auto overscroll-none animate-modalIn flex flex-col"
      >
        {/*
          key={todo.id} remounts PanelBody whenever the user switches between
          todos, so uncontrolled inputs (title, description, estimate) reset to
          the new todo's values rather than keeping stale ones.
        */}
        <PanelBody key={todo.id} todo={todo} />
      </div>
    </div>,
    document.body
  );
}

function PanelBody({ todo }: { todo: Todo }) {
  const { updateTodo, toggleComplete, deleteTodo, createTodo, detach, setOpenTodoId } = useTodos();
  const { spaces } = useSpaces();
  const [popover, setPopover] = useState<OpenPopover>(null);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const timeRef = useRef<HTMLButtonElement>(null);
  const reminderRef = useRef<HTMLButtonElement>(null);
  const repeatRef = useRef<HTMLButtonElement>(null);
  const attachRef = useRef<HTMLButtonElement>(null);

  const today = todayISO();
  const locked = isParentLocked(todo);
  const subtasks = todo.subtasks || [];
  const doneCount = subtasks.filter((s) => s.is_completed).length;

  // Auto-size the title textarea on mount so long titles expand immediately.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  async function addSubtask() {
    const title = subtaskDraft.trim();
    if (!title) return;
    setSubtaskDraft('');
    await createTodo({ title, parent_id: todo.id });
  }

  return (
    <>
      <header className="flex items-center gap-2 px-[18px] py-[13px] border-b border-border-default flex-shrink-0">
        <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-text-faint">
          To-do
        </span>
        <div className="ml-auto flex items-center gap-2.5 text-text-muted">
          <button
            type="button"
            onClick={() => setConfirmDelete((v) => !v)}
            aria-label="More options"
            className="hover:text-text-secondary transition-colors duration-120"
          >
            <OverflowIcon size={15} />
          </button>
          <button
            type="button"
            onClick={() => setOpenTodoId(null)}
            aria-label="Close"
            className="hover:text-text-secondary transition-colors duration-120"
          >
            <CloseIcon size={15} />
          </button>
        </div>
      </header>

      {confirmDelete && (
        <div className="px-[18px] py-3 bg-danger-bg border-b border-danger-border flex items-center gap-3">
          <span className="flex-1 text-12 text-text-primary">Delete this to-do and its sub-tasks?</span>
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="text-12 text-text-secondary px-2 py-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => deleteTodo(todo.id)}
            className="text-12 font-medium text-accent-ink bg-danger rounded-btn px-3 py-1.5"
          >
            Delete
          </button>
        </div>
      )}

      <div className="p-[18px] flex flex-col gap-[18px]">
        <div className="flex items-start gap-3">
          <span className="mt-[3px]">
            <TodoCheckbox
              checked={todo.is_completed}
              onChange={() => toggleComplete(todo.id)}
              label={todo.is_completed ? `Reopen ${todo.title}` : `Mark ${todo.title} done`}
              size={20}
              radius={6}
              tone={todo.is_completed ? 'green' : 'accent'}
              disabled={locked}
              disabledReason="Finish the sub-tasks first — this to-do is set to Dependent"
            />
          </span>
          {/*
            A textarea rather than an input: to-do titles wrap to two and three
            lines often enough that a single-line field that scrolls sideways
            would hide the end of most of them. defaultValue + key={todo.id}
            means this remounts (and resets) when the panel switches to a
            different to-do; the auto-size effect then runs again.
          */}
          <textarea
            ref={titleRef}
            defaultValue={todo.title}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (next && next !== todo.title) updateTodo(todo.id, { title: next });
              else e.target.value = todo.title;
            }}
            aria-label="Title"
            className="flex-1 min-w-0 resize-none bg-transparent border-none outline-none text-[17px] leading-[1.35] text-[color:var(--heading-color)]"
            style={{ fontWeight: 580, letterSpacing: '-0.01em', height: 'auto', overflow: 'hidden' }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${el.scrollHeight}px`;
            }}
          />
        </div>

        <textarea
          defaultValue={todo.description ?? ''}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next !== (todo.description ?? '')) updateTodo(todo.id, { description: next || null });
          }}
          placeholder="Add a short description…"
          aria-label="Description"
          rows={2}
          className="resize-none bg-transparent border-none outline-none text-12.5 text-text-secondary leading-[1.55] placeholder:text-text-faint"
        />

        <div className="flex flex-col border border-border-default rounded-widget overflow-hidden">
          <PropertyRow
            ref={dateRef}
            icon={<CalendarIcon size={14} />}
            label="Date"
            value={todo.due_date ? formatDueLabel(todo.due_date, today) : 'No date'}
            muted={!todo.due_date}
            onClick={() => setPopover(popover === 'deadline' ? null : 'deadline')}
          />
          <PropertyRow
            ref={timeRef}
            icon={<ClockIcon size={14} />}
            label="Time"
            value={formatTime(todo.due_time) ?? 'No time'}
            muted={!todo.due_time}
            onClick={() => setPopover(popover === 'deadline' ? null : 'deadline')}
          />
          <EstimateRow todo={todo} onChange={(minutes) => updateTodo(todo.id, { estimate_minutes: minutes })} />
          <PropertyRow
            ref={reminderRef}
            icon={<BellIcon size={14} />}
            label="Reminder"
            value={todo.reminder ? reminderLabel(todo.reminder.lead) : 'None'}
            muted={!todo.reminder}
            onClick={() => setPopover(popover === 'reminder' ? null : 'reminder')}
          />
          <PropertyRow
            ref={repeatRef}
            icon={<RepeatIcon size={14} />}
            label="Repeat"
            value={todo.recurrence ? recurrenceLabel(todo.recurrence) : 'Doesn’t repeat'}
            muted={!todo.recurrence}
            onClick={() => setPopover(popover === 'repeat' ? null : 'repeat')}
          />

          <div className="flex items-center gap-2.5 px-[13px] py-[11px]">
            <span className="w-3.5 flex justify-center flex-shrink-0">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: todo.space?.color || 'var(--border-medium)' }}
              />
            </span>
            <label htmlFor="todo-space" className="flex-1 text-12.5 text-text-secondary">
              Space
            </label>
            <select
              id="todo-space"
              value={todo.space_id ?? ''}
              onChange={(e) => updateTodo(todo.id, { space_id: e.target.value || null })}
              className="bg-transparent text-12.5 text-text-primary font-medium outline-none text-right"
            >
              <option value="">None</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Sub-tasks */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <h3 className="m-0 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-text-faint">
              Sub-tasks{subtasks.length > 0 && ` · ${doneCount} of ${subtasks.length}`}
            </h3>
            <div className="flex-1 h-px bg-border-light" />
            <SubtaskModeToggle
              mode={todo.subtask_mode}
              onChange={(subtask_mode) => updateTodo(todo.id, { subtask_mode })}
            />
          </div>

          {subtasks.map((subtask) => (
            <SubtaskPanelRow
              key={subtask.id}
              subtask={subtask}
              onToggle={() => toggleComplete(subtask.id)}
              onDelete={() => deleteTodo(subtask.id)}
              onRename={(title) => updateTodo(subtask.id, { title })}
              onOpenDetail={() => setOpenTodoId(subtask.id)}
            />
          ))}

          {/* Add sub-task input */}
          <input
            value={subtaskDraft}
            onChange={(e) => setSubtaskDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSubtask();
              }
              if (e.key === 'Escape') {
                setSubtaskDraft('');
              }
            }}
            placeholder="+ sub-task"
            aria-label="Add a sub-task"
            className="bg-transparent border-none outline-none text-12.5 text-text-primary placeholder:text-text-faint pl-[27px]"
          />
        </section>

        {/* Attachments */}
        <section className="flex flex-col gap-2">
          <h3 className="m-0 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-text-faint">
            Attachments
          </h3>

          {(todo.attachments || []).map((attachment) => {
            const isNote = attachment.kind === 'note';
            const title = isNote
              ? attachment.note?.title || 'Untitled note'
              : attachment.file?.filename || 'File';
            const meta = isNote
              ? attachment.note?.updated_at
                ? `Note · edited ${formatRelativeTime(attachment.note.updated_at)}`
                : 'Note'
              : attachment.file
              ? formatFileSize(attachment.file.size_bytes)
              : '';

            const inner = (
              <>
                <span
                  className={`w-7 h-7 rounded-btn flex items-center justify-center flex-shrink-0 ${
                    isNote ? 'bg-accent-blue-bg text-accent-blue-dark' : 'bg-bg-elevated text-text-secondary'
                  }`}
                >
                  {isNote ? <NoteIcon size={14} /> : <PaperclipIcon size={14} />}
                </span>
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="text-12.5 text-text-primary truncate">{title}</span>
                  <span className="text-10.5 text-text-faint">{meta}</span>
                </span>
              </>
            );

            return (
              <div
                key={attachment.id}
                className="flex items-center gap-2.5 border border-border-default rounded-widget px-3 py-2.5"
              >
                {isNote && attachment.note_id ? (
                  <Link
                    href={`/note/${attachment.note_id}`}
                    className="flex items-center gap-2.5 flex-1 min-w-0 no-underline"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">{inner}</div>
                )}
                <button
                  type="button"
                  onClick={() => detach(todo.id, attachment.id)}
                  aria-label={`Remove ${title}`}
                  title="Remove from this to-do — the original is kept"
                  className="text-text-faint hover:text-danger transition-colors duration-120 flex-shrink-0"
                >
                  <CloseIcon size={13} />
                </button>
              </div>
            );
          })}

          <button
            ref={attachRef}
            type="button"
            onClick={() => setPopover(popover === 'attach' ? null : 'attach')}
            className="self-start flex items-center gap-1.5 text-11.5 text-accent-blue-dark border border-border-medium rounded-btn px-[11px] py-1.5 hover:bg-accent-blue-bg transition-colors duration-120"
          >
            <PlusIcon size={11} /> Attach a note or file
          </button>
        </section>
      </div>

      {popover === 'deadline' && (
        <DeadlinePopover
          anchorRef={dateRef}
          onClose={() => setPopover(null)}
          date={todo.due_date}
          time={todo.due_time}
          onChange={(next) => updateTodo(todo.id, next)}
        />
      )}
      {popover === 'reminder' && (
        <ReminderPopover
          anchorRef={reminderRef}
          onClose={() => setPopover(null)}
          reminder={todo.reminder}
          onChange={(reminder) => updateTodo(todo.id, { reminder })}
        />
      )}
      {popover === 'repeat' && (
        <RepeatPopover
          anchorRef={repeatRef}
          onClose={() => setPopover(null)}
          recurrence={todo.recurrence}
          onChange={(recurrence) => updateTodo(todo.id, { recurrence })}
        />
      )}
      {popover === 'attach' && (
        <AttachPopover anchorRef={attachRef} onClose={() => setPopover(null)} todo={todo} />
      )}
    </>
  );
}

/**
 * A single sub-task row inside the detail panel.
 *
 * Editable title (inline input on click), delete button, and an "Open" button
 * to navigate into the sub-task's own detail panel where its deadline can be set.
 */
function SubtaskPanelRow({
  subtask,
  onToggle,
  onDelete,
  onRename,
  onOpenDetail,
}: {
  subtask: Todo;
  onToggle: () => unknown;
  onDelete: () => unknown;
  onRename: (title: string) => unknown;
  onOpenDetail: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function commitEdit(value: string) {
    const next = value.trim();
    if (next && next !== subtask.title) onRename(next);
    setEditing(false);
  }

  return (
    <div className="flex items-center gap-2.5 group/subtask">
      <TodoCheckbox
        checked={subtask.is_completed}
        onChange={onToggle}
        label={subtask.is_completed ? `Reopen ${subtask.title}` : `Mark ${subtask.title} done`}
        size={17}
        radius={5}
      />

      {editing ? (
        <input
          ref={inputRef}
          defaultValue={subtask.title}
          autoFocus
          onBlur={(e) => commitEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commitEdit(e.currentTarget.value); }
            if (e.key === 'Escape') { setEditing(false); }
          }}
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-13 text-text-primary"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Click to edit"
          className={`flex-1 min-w-0 text-left text-13 ${
            subtask.is_completed ? 'text-text-muted line-through' : 'text-text-primary'
          } hover:text-accent-blue-dark transition-colors duration-120`}
        >
          {subtask.title}
        </button>
      )}

      {/* Open detail to set deadline etc. */}
      <button
        type="button"
        onClick={onOpenDetail}
        aria-label={`Open ${subtask.title} details`}
        title="Open details (set deadline, etc.)"
        className="opacity-0 group-hover/subtask:opacity-100 transition-opacity duration-120 text-text-faint hover:text-text-secondary flex-shrink-0"
      >
        <CalendarIcon size={12} />
      </button>

      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${subtask.title}`}
        title="Delete sub-task"
        className="opacity-0 group-hover/subtask:opacity-100 transition-opacity duration-120 text-text-faint hover:text-danger flex-shrink-0"
      >
        <CloseIcon size={12} />
      </button>
    </div>
  );
}

interface PropertyRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  muted?: boolean;
  onClick: () => void;
}

/** Forwards its ref so the popover it opens can anchor itself to this row. */
const PropertyRow = forwardRef<HTMLButtonElement, PropertyRowProps>(function PropertyRow(
  { icon, label, value, muted, onClick },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 px-[13px] py-[11px] border-b border-border-light text-left hover:bg-bg-surface transition-colors duration-120"
    >
      <span className="text-text-muted flex-shrink-0">{icon}</span>
      <span className="flex-1 text-12.5 text-text-secondary">{label}</span>
      <span className={`text-12.5 font-medium ${muted ? 'text-text-muted' : 'text-text-primary'}`}>
        {value}
      </span>
    </button>
  );
});

/** Estimates are a free-text minute count, so they get a field rather than a popover. */
function EstimateRow({ todo, onChange }: { todo: Todo; onChange: (minutes: number | null) => void }) {
  return (
    <div className="flex items-center gap-2.5 px-[13px] py-[11px] border-b border-border-light">
      <span className="w-3.5 text-center font-mono text-12 text-text-muted flex-shrink-0" aria-hidden="true">
        ~
      </span>
      <label htmlFor="todo-estimate" className="flex-1 text-12.5 text-text-secondary">
        Estimate
      </label>
      <input
        id="todo-estimate"
        type="number"
        min={1}
        max={1440}
        defaultValue={todo.estimate_minutes ?? ''}
        placeholder="—"
        onBlur={(e) => {
          const raw = e.target.value.trim();
          const minutes = raw ? Math.min(1440, Math.max(1, Number(raw))) : null;
          if (minutes !== todo.estimate_minutes) onChange(minutes);
        }}
        className="w-16 bg-transparent text-12.5 text-text-primary font-medium outline-none text-right"
      />
      <span className="text-12.5 text-text-muted w-8">
        {todo.estimate_minutes ? formatEstimate(todo.estimate_minutes) : 'min'}
      </span>
    </div>
  );
}

/**
 * Independent / Dependent.
 *
 * Independent is the default and stays the default: a parent whose checkbox is
 * locked until every sub-task is ticked is a to-do that cannot be closed when
 * the last sub-task turns out not to matter, and being unable to finish
 * something you have finished is its own small demoralisation.
 */
function SubtaskModeToggle({
  mode,
  onChange,
}: {
  mode: SubtaskMode;
  onChange: (next: SubtaskMode) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Sub-task completion" className="flex bg-bg-subtle rounded-full p-0.5">
      {(['independent', 'dependent'] as SubtaskMode[]).map((option) => {
        const active = mode === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option)}
            title={
              option === 'independent'
                ? 'Tick the parent whenever you like'
                : 'The parent closes when its last sub-task does'
            }
            className={`text-10.5 rounded-full px-2.5 py-[3px] capitalize transition-colors duration-120 ${
              active ? 'bg-bg-base text-text-primary' : 'text-text-muted'
            }`}
            style={{ fontWeight: active ? 580 : 400 }}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
