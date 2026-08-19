'use client';

import { Fragment, useState } from 'react';
import { formatDueLabel, overdueAge, todayISO } from '@/lib/todos';
import type { Todo } from '@/types';
import { DropIndicator, useTodoDrag } from './TodoDragContext';
import { InlineAddRow, QuietAddButton } from './QuickAdd';
import { TodoRow } from './TodoRow';
import { useTodoActions } from './TodoProvider';

interface TodoGroupProps {
  /** Drop-target key: an ISO date, '' for Anytime (no date), or 'overdue'. */
  groupKey: string;
  title: string;
  /** Open rows. */
  todos: Todo[];
  /** Completed rows for the same day, rendered dimmed under their own hairline. */
  done?: Todo[];
  showDone?: boolean;
  tone?: 'default' | 'today' | 'overdue';
  /** Trailing control on the header row — "Move all to today", "+ add here". */
  action?: React.ReactNode;
  /** Renders the dashed add row at the bottom of the group. */
  addRow?: { dueDate: string | null; label: string } | null;
  compact?: boolean;
  /** Caps the visible open rows and folds the rest behind a "N more" row. */
  cap?: number | null;
  /**
   * An empty day inside a month, folded to one line.
   *
   * The Month view renders every day of every week, so a month with work on
   * eight days would otherwise be twenty-two full-height empty headings. Quiet
   * keeps the day present — it is still a labelled drop target with its own add
   * button — while taking it down to the height of a single row.
   */
  quiet?: boolean;
}

/**
 * One date group in a to-do list.
 *
 * Also the drag-and-drop drop zone: `data-drop-group` on the rows container is
 * what the drag controller hit-tests against, and the insertion line is drawn
 * between rows from the index it reports back.
 */
export function TodoGroup({
  groupKey,
  title,
  todos,
  done = [],
  showDone = true,
  tone = 'default',
  action,
  addRow = null,
  compact = false,
  cap = null,
  quiet = false,
}: TodoGroupProps) {
  const { dropIndexFor, draggingId } = useTodoDrag();
  const [expanded, setExpanded] = useState(false);
  const dropIndex = dropIndexFor(groupKey);

  // Still a drop group, still an add button — just one line tall.
  if (quiet && todos.length === 0 && done.length === 0) {
    return (
      <div
        data-drop-group={groupKey}
        className={`flex items-center gap-2.5 rounded-btn px-2 -mx-2 transition-colors duration-120 ${
          dropIndex !== null ? 'bg-accent-blue-bg' : ''
        }`}
      >
        <span
          className={`font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] ${
            tone === 'today' ? 'text-accent-blue-dark' : 'text-text-faint'
          }`}
        >
          {title}
        </span>
        <div className="flex-1 h-px bg-border-light" />
        {addRow && <QuietAddButton dueDate={addRow.dueDate} label={addRow.label} />}
      </div>
    );
  }

  const capped = cap !== null && !expanded && todos.length > cap;
  const visible = capped ? todos.slice(0, cap) : todos;
  const hidden = todos.length - visible.length;

  const headerColor =
    tone === 'overdue'
      ? 'text-accent-amber-dark'
      : tone === 'today'
      ? 'text-accent-blue-dark'
      : 'text-text-muted';

  return (
    <section className="flex flex-col gap-[9px]">
      <div className="flex items-center gap-2.5">
        <h2
          className={`m-0 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] ${headerColor}`}
        >
          {title}
        </h2>
        {(todos.length > 0 || done.length > 0) && (
          <span className="text-11 text-text-muted">
            {todos.length} open{done.length > 0 && ` · ${done.length} done`}
          </span>
        )}
        <div className="flex-1 h-px bg-border-default" />
        {action}
      </div>

      <div data-drop-group={groupKey} className="flex flex-col gap-[9px]">
        {visible.map((todo, index) => (
          <Fragment key={todo.id}>
            {dropIndex === index && <DropIndicator />}
            <TodoRow
              todo={todo}
              groupKey={groupKey}
              index={index}
              compact={compact}
              dragged={draggingId === todo.id}
            />
          </Fragment>
        ))}
        {/* The line past the last row, for an append. Only meaningful when the
            group is not folded — the drop would land somewhere unseen. */}
        {dropIndex !== null && dropIndex >= visible.length && !capped && <DropIndicator />}

        {todos.length === 0 && done.length === 0 && !addRow && (
          <p className="m-0 text-12 text-text-faint py-1">Nothing here.</p>
        )}
      </div>

      {capped && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-11.5 text-accent-blue-dark hover:underline"
        >
          {hidden} more today
        </button>
      )}

      {showDone && done.length > 0 && (
        <>
          <div className="flex items-center gap-2.5 pl-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-text-faint">
              Done
            </span>
            <div className="flex-1 h-px bg-border-light" />
          </div>
          {done.map((todo, index) => (
            <TodoRow
              key={todo.id}
              todo={todo}
              groupKey={groupKey}
              index={visible.length + index}
              compact
            />
          ))}
        </>
      )}

      {addRow && <InlineAddRow dueDate={addRow.dueDate} label={addRow.label} />}
    </section>
  );
}

/**
 * Carried over — the to-dos that did not get done on the day they were for.
 *
 * Pinned above everything under every filter, so nothing that slipped can be
 * out of sight; today's list always opens with them. The tone is the whole
 * design: amber rather than red, "carried over" rather than "overdue" or
 * "late", counted in days rather than scolded about, and a single button that
 * clears the entire backlog onto today. Nothing here should read as a
 * telling-off — being behind is a state of affairs, and the useful thing a
 * to-do list can do about it is make catching up one tap.
 */
export function OverdueGroup({ todos }: { todos: Todo[] }) {
  const { updateTodo, announce } = useTodoActions();
  const { dropIndexFor, draggingId } = useTodoDrag();
  const today = todayISO();
  const [busy, setBusy] = useState(false);
  const dropIndex = dropIndexFor('overdue');

  if (todos.length === 0) return null;

  async function moveAll() {
    setBusy(true);
    // Sent together rather than one after another: with a week's backlog the
    // sequential version took long enough that rows visibly trickled upward.
    await Promise.all(todos.map((todo) => updateTodo(todo.id, { due_date: today })));
    setBusy(false);
    announce(`Brought ${todos.length} carried-over to-dos to today`);
  }

  // The oldest one sets the tone of the summary line — "since Friday" is a
  // more useful thing to know than a raw count.
  const oldest = todos.reduce(
    (min, todo) => (todo.due_date && todo.due_date < min ? todo.due_date : min),
    today
  );

  return (
    <section
      className="flex flex-col gap-[11px] rounded-card px-4 py-[15px]"
      style={{
        background: 'var(--accent-amber-bg)',
        border: '1px solid var(--accent-amber-border)',
      }}
    >
      <div className="flex items-center gap-2.5 flex-wrap">
        <h2 className="m-0 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-accent-amber-dark">
          Carried over · {todos.length}
        </h2>
        <span className="text-11 text-accent-amber-dark opacity-80">
          waiting since {formatDueLabel(oldest, today).toLowerCase()}
        </span>
        <div className="flex-1 h-px" style={{ background: 'var(--accent-amber-border)' }} />
        <button
          type="button"
          onClick={moveAll}
          disabled={busy}
          className="h-8 inline-flex items-center text-11.5 text-accent-amber-dark bg-bg-base rounded-btn px-3 font-medium hover:opacity-85 disabled:opacity-50 transition-opacity duration-120 whitespace-nowrap"
          style={{ border: '1px solid var(--accent-amber-border)' }}
        >
          {busy ? 'Moving…' : 'Bring all to today'}
        </button>
      </div>

      <p className="m-0 text-11.5 text-accent-amber-dark opacity-80 leading-[1.5]">
        Still open from before today. Pull one forward, push it out, or let it go — no wrong answer.
      </p>

      <div data-drop-group="overdue" className="flex flex-col gap-[9px]">
        {todos.map((todo, index) => (
          <Fragment key={todo.id}>
            {dropIndex === index && <DropIndicator />}
            <div className="flex items-center gap-2.5">
              <span
                className="hidden sm:inline-block w-[62px] flex-shrink-0 text-right font-mono text-[9.5px] uppercase tracking-[0.06em] text-accent-amber-dark opacity-70"
                aria-hidden="true"
              >
                {todo.due_date ? overdueAge(todo.due_date, today) : ''}
              </span>
              <div className="flex-1 min-w-0">
                <TodoRow
                  todo={todo}
                  groupKey="overdue"
                  index={index}
                  compact
                  dragged={draggingId === todo.id}
                />
              </div>
            </div>
          </Fragment>
        ))}
        {dropIndex !== null && dropIndex >= todos.length && <DropIndicator />}
      </div>
    </section>
  );
}
