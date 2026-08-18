'use client';

import { useMemo } from 'react';
import { formatDayHeading, formatEstimate, todayISO } from '@/lib/todos';
import type { Todo } from '@/types';
import { StarIcon } from './icons';
import { useTodos } from './TodoProvider';

/**
 * The day's headline: what is left, roughly how long it is, and the evidence
 * that any of it is going anywhere.
 *
 * The progress bar and streak are the "visible progress" half of the ADHD
 * brief, and both are switchable off in Settings — for someone who finds a
 * broken streak discouraging rather than motivating, a streak counter is worse
 * than no counter at all.
 */
export function TodayHeader({ open, done }: { open: Todo[]; done: Todo[] }) {
  const { prefs, todos } = useTodos();
  const today = todayISO();

  const totalMinutes = useMemo(
    () => open.reduce((sum, todo) => sum + (todo.estimate_minutes || 0), 0),
    [open]
  );

  const streak = useStreak(todos);
  const total = open.length + done.length;
  const percent = total ? Math.round((done.length / total) * 100) : 0;

  return (
    <header className="flex items-end gap-5 flex-wrap">
      <div className="flex flex-col gap-[5px]">
        <h1
          className="m-0 font-serif text-[26px] font-normal text-[color:var(--heading-color)]"
          style={{ letterSpacing: '-0.015em' }}
        >
          {formatDayHeading(today)}
        </h1>
        <p className="m-0 text-12.5 text-text-muted">
          {open.length} to go
          {done.length > 0 && ` · ${done.length} done`}
          {prefs.showEstimates && totalMinutes > 0 && (
            <> · roughly {formatEstimate(totalMinutes, true)} of work</>
          )}
        </p>
      </div>

      {prefs.showProgress && total > 0 && (
        <div className="ml-auto flex items-center gap-4">
          <div className="flex flex-col gap-1.5 w-[200px]">
            <div
              className="h-1.5 rounded-full bg-bg-elevated overflow-hidden"
              role="progressbar"
              aria-valuenow={done.length}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label="To-dos done today"
            >
              <div
                className="h-full rounded-full bg-accent-blue transition-all duration-220"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="font-mono text-[9.5px] tracking-[0.06em] text-text-muted">
              {done.length} / {total} DONE TODAY
            </span>
          </div>

          {streak > 1 && (
            <div
              className="flex items-center gap-[7px] bg-accent-amber-bg rounded-full px-3 py-1.5"
              style={{ border: '1px solid var(--chip-note-border)' }}
            >
              <StarIcon size={13} className="text-accent-amber" />
              <span className="text-11.5 text-accent-amber-dark" style={{ fontWeight: 580 }}>
                {streak}-day streak
              </span>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

/**
 * Consecutive days ending today (or yesterday) on which something was ticked.
 *
 * Counted from `completed_at` on whatever is loaded, which means it only sees
 * the current window — a Today view holds today's completions and little else,
 * so this reads 1 there rather than a true history. It is deliberately
 * generous at the start: a streak that keeps its count when today is still
 * empty is the difference between "keep going" and "you have already lost it",
 * which is exactly the wrong message before 9am.
 */
function useStreak(todos: Todo[]): number {
  return useMemo(() => {
    const days = new Set(
      todos
        .filter((t) => t.completed_at)
        .map((t) => new Date(t.completed_at!).toLocaleDateString('en-CA'))
    );
    if (days.size === 0) return 0;

    const cursor = new Date();
    // Today not being done yet does not break a streak that stands on
    // yesterday — it is still live until midnight.
    if (!days.has(cursor.toLocaleDateString('en-CA'))) cursor.setDate(cursor.getDate() - 1);

    let count = 0;
    while (days.has(cursor.toLocaleDateString('en-CA'))) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [todos]);
}
