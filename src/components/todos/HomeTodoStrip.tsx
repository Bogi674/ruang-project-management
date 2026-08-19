'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TODOS_CHANGED_EVENT, emitTodosChanged } from '@/lib/dnd';
import { formatTime, isOverdue, todayISO } from '@/lib/todos';
import type { Todo, TodoGroups } from '@/types';
import { TodoCheckbox } from './TodoCheckbox';

/** Three is the strip's job — a fourth turns Home into a second To-do page. */
const VISIBLE = 3;

/**
 * The Today strip on Home.
 *
 * A read-and-tick surface, not an editor: the point is that opening Home
 * answers "what am I meant to be doing" without a second navigation, and that
 * anything already done can be ticked where it is seen.
 *
 * It fetches its own data rather than taking it from the page's server render,
 * because Home is a server component shared with notes and widgets and this
 * strip has to stay live after a tick without re-rendering all of it.
 */
export function HomeTodoStrip() {
  const [groups, setGroups] = useState<TodoGroups | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const today = todayISO();

  const load = useCallback(() => {
    fetch('/api/todos?filter=today')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: TodoGroups | null) => setGroups(data))
      .catch(() => setGroups(null));
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(TODOS_CHANGED_EVENT, load);
    return () => window.removeEventListener(TODOS_CHANGED_EVENT, load);
  }, [load]);

  async function tick(todo: Todo) {
    // Optimistic: the row dims immediately and the list is reloaded once the
    // write lands, rather than the tick waiting on a round trip.
    setPending((current) => [...current, todo.id]);
    try {
      await fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: true }),
      });
      emitTodosChanged();
    } finally {
      setPending((current) => current.filter((id) => id !== todo.id));
    }
  }

  if (!groups) return null;

  const open = [...groups.overdue, ...(groups.dated[today] || [])].filter(
    (todo) => !pending.includes(todo.id)
  );
  const done = (groups.done[today] || []).length;

  // Nothing to do and nothing done: Home says nothing rather than showing an
  // empty section with a heading. The FAB is the affordance there.
  if (open.length === 0 && done === 0) return null;

  const visible = open.slice(0, VISIBLE);
  const remaining = open.length - visible.length;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2.5 mb-3">
        <h2 className="m-0 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-text-faint">
          {open.length > 0 ? `Today · ${open.length} to go` : 'Today · all done'}
        </h2>
        <div className="flex-1 h-px bg-border-default" />
        <Link href="/todo" className="text-11.5 text-accent-blue-dark no-underline hover:underline">
          Open To-do
        </Link>
      </div>

      {open.length === 0 ? (
        <p className="m-0 text-13 text-text-muted">
          {done} done today. Nothing else is due.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visible.map((todo) => {
            const overdue = isOverdue(todo);
            const time = formatTime(todo.due_time);
            return (
              <div
                key={todo.id}
                className="flex items-center gap-3 bg-bg-base border border-border-default rounded-card px-[15px] py-3 shadow-card"
              >
                <TodoCheckbox
                  checked={false}
                  onChange={() => tick(todo)}
                  label={`Mark ${todo.title} done`}
                />
                <Link
                  href="/todo"
                  className="flex-1 min-w-0 text-13.5 text-text-primary no-underline truncate"
                >
                  {todo.title}
                </Link>
                {todo.estimate_minutes && (
                  <span className="font-mono text-10 text-text-secondary border border-border-default rounded-[5px] px-1.5 py-[2px] flex-shrink-0">
                    {todo.estimate_minutes}m
                  </span>
                )}
                {overdue ? (
                  <span
                    className="text-11 text-accent-amber-dark bg-accent-amber-bg rounded-[5px] px-[7px] py-[2px] flex-shrink-0"
                    style={{ border: '1px solid var(--accent-amber-border)' }}
                  >
                    Overdue
                  </span>
                ) : (
                  time && (
                    <span className="text-11 text-accent-blue-dark bg-accent-blue-bg rounded-[5px] px-[7px] py-[2px] flex-shrink-0">
                      {time}
                    </span>
                  )
                )}
              </div>
            );
          })}

          {(remaining > 0 || done > 0) && (
            <span className="text-11.5 text-text-faint">
              {remaining > 0 && `${remaining} more`}
              {remaining > 0 && done > 0 && ' · '}
              {done > 0 && `${done} done`}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
