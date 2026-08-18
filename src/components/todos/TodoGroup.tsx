'use client';

import { Fragment, useState } from 'react';
import { formatDueLabel, todayISO } from '@/lib/todos';
import type { Todo } from '@/types';
import { DropIndicator, useTodoDrag } from './TodoDragContext';
import { InlineAddRow } from './QuickAdd';
import { TodoRow } from './TodoRow';
import { useTodos } from './TodoProvider';

interface TodoGroupProps {
  /** Drop-target key: an ISO date, '' for unassigned, or 'overdue'. */
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
}: TodoGroupProps) {
  const { dropIndexFor } = useTodoDrag();
  const [expanded, setExpanded] = useState(false);
  const dropIndex = dropIndexFor(groupKey);

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
            <TodoRow todo={todo} groupKey={groupKey} index={index} compact={compact} />
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
            <TodoRow key={todo.id} todo={todo} groupKey={groupKey} index={visible.length + index} compact />
          ))}
        </>
      )}

      {addRow && <InlineAddRow dueDate={addRow.dueDate} label={addRow.label} />}
    </section>
  );
}

/**
 * The "Overdue · 3" group.
 *
 * Pinned above everything under every filter, with one button that clears the
 * whole backlog to today — the single most useful action on the page for
 * someone who has been away for a few days.
 */
export function OverdueGroup({ todos }: { todos: Todo[] }) {
  const { updateTodo, announce } = useTodos();
  const today = todayISO();

  if (todos.length === 0) return null;

  async function moveAll() {
    await Promise.all(todos.map((todo) => updateTodo(todo.id, { due_date: today })));
    announce(`Moved ${todos.length} overdue to-dos to today`);
  }

  return (
    <TodoGroup
      groupKey="overdue"
      title={`Overdue · ${todos.length}`}
      todos={todos}
      tone="overdue"
      compact
      action={
        <button
          type="button"
          onClick={moveAll}
          className="text-11.5 text-accent-blue-dark border border-border-medium rounded-btn px-2.5 py-[5px] hover:bg-accent-blue-bg transition-colors duration-120"
        >
          Move all to today
        </button>
      }
    />
  );
}

/** Formats a group's header — "Today · Tue 18 Aug", "Wed 19 Aug". */
export function dateGroupTitle(iso: string, today: string): string {
  const label = formatDueLabel(iso, today);
  if (iso === today) return `Today · ${new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`;
  return label;
}
