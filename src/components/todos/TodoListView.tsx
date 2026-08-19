'use client';

import { useState } from 'react';
import { formatDueLabel, todayISO } from '@/lib/todos';
import type { Todo } from '@/types';
import { EmptyState } from './EmptyState';
import { QuickAdd } from './QuickAdd';
import { OverdueGroup, TodoGroup } from './TodoGroup';
import { TodoRow } from './TodoRow';
import { TodayHeader } from './TodayHeader';
import { UnassignedColumn } from './UnassignedColumn';
import { useTodos } from './TodoProvider';

/**
 * The list half of /todo.
 *
 * Today is a single day with a headline; Week, Month and All are the same
 * grouped list scoped to a period.
 *
 * One measure for all four. Today used to be centred in an 820–920px column
 * while Week and Month ran the full width of the window, so switching range
 * re-flowed every row and the same to-do was a different width depending on
 * which tab you were on. `COLUMN` is that measure, and the only view that adds
 * anything beside it is All — which puts the undated pile in its own column,
 * because that is the one range long enough to bury it.
 */
const COLUMN = 'w-full max-w-[920px] mx-auto px-8 pt-[26px] pb-8 flex flex-col gap-5';

export function TodoListView({ composeRef }: { composeRef?: React.RefObject<HTMLDivElement> }) {
  const { groups, filter, loading } = useTodos();
  const today = todayISO();

  if (loading && Object.keys(groups.dated).length === 0 && groups.unassigned.length === 0) {
    return <TodoListSkeleton />;
  }

  if (filter === 'today') return <TodayView composeRef={composeRef} />;

  const dates = Object.keys(groups.dated).sort();
  const isAll = filter === 'all';

  const list = (
    <div className={`${COLUMN} flex-1 min-w-0`}>
      <div ref={composeRef}>
        <QuickAdd
          placeholder="Add a to-do — lands in Today unless you name a date"
          showShortcut
        />
      </div>

      <OverdueGroup todos={groups.overdue} />

      {dates.map((date) => (
        <TodoGroup
          key={date}
          groupKey={date}
          title={
            date === today
              ? `Today · ${new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`
              : new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
          }
          tone={date === today ? 'today' : 'default'}
          todos={groups.dated[date]}
          done={groups.done[date] || []}
          compact
          addRow={{ dueDate: date, label: `Add to ${formatDueLabel(date, today)}` }}
        />
      ))}

      {/* Only the two-column All view moves undated work into its own column;
          in Week and Month it stays inline, where the list is short enough
          that it is still visible. */}
      {!isAll && groups.unassigned.length > 0 && (
        <TodoGroup
          groupKey=""
          title="Unassigned"
          todos={groups.unassigned}
          compact
          addRow={{ dueDate: null, label: 'Add without a date' }}
        />
      )}

      {dates.length === 0 && groups.overdue.length === 0 && groups.unassigned.length === 0 && (
        <EmptyState variant={groups.counts.total === 0 ? 'nothing-at-all' : 'nothing-in-range'} />
      )}
    </div>
  );

  if (!isAll) return list;

  return (
    <div className="flex flex-col md:flex-row">
      {list}
      {/* Below the desktop breakpoint the column becomes a section directly
          under the filter bar rather than at the very bottom — the same
          "never bury it" reasoning, applied to a single-column layout. */}
      <div className="md:hidden order-first px-8 pt-5 w-full max-w-[920px] mx-auto">
        <TodoGroup
          groupKey=""
          title={`Unassigned · ${groups.unassigned.length}`}
          todos={groups.unassigned}
          compact
          addRow={{ dueDate: null, label: 'Add without a date' }}
        />
      </div>
      <div className="hidden md:block">
        <UnassignedColumn todos={groups.unassigned} />
      </div>
    </div>
  );
}

function TodayView({ composeRef }: { composeRef?: React.RefObject<HTMLDivElement> }) {
  const { groups, prefs } = useTodos();
  const today = todayISO();
  const [showDone, setShowDone] = useState(true);

  const open = groups.dated[today] || [];
  const done = groups.done[today] || [];
  const overdue = groups.overdue;

  const nothingLeft = open.length === 0 && overdue.length === 0;

  return (
    <div className={COLUMN}>
      <TodayHeader open={[...overdue, ...open]} done={done} />

      <div ref={composeRef}>
        <QuickAdd showShortcut />
      </div>

      {/* Carried-over work sits above today's own list under every filter —
          see OverdueGroup for why it is amber and phrased the way it is. */}
      <OverdueGroup todos={overdue} />

      {nothingLeft ? (
        <EmptyState
          variant={done.length > 0 ? 'all-done' : 'nothing-today'}
          doneCount={done.length}
          unassignedCount={groups.unassigned.length}
        />
      ) : (
        <TodoGroup
          groupKey={today}
          title={`Today · ${open.length}`}
          tone="today"
          todos={open}
          done={[]}
          cap={prefs.todayCap}
          addRow={{ dueDate: today, label: 'Add to today' }}
        />
      )}

      {/*
        Undated work is shown on Today as well, folded to a few rows.
        Without it Today is the one range with no `groupKey=""` drop target on
        screen, so a to-do could be dragged onto a date from anywhere but never
        back off one — and "clear the date" is half of what dragging is for.
      */}
      {groups.unassigned.length > 0 && (
        <TodoGroup
          groupKey=""
          title="No date"
          todos={groups.unassigned}
          compact
          cap={3}
          addRow={{ dueDate: null, label: 'Add without a date' }}
        />
      )}

      {done.length > 0 && (
        <section className="flex flex-col gap-[9px]">
          <div className="flex items-center gap-2.5 mt-1.5">
            <h2 className="m-0 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-text-faint">
              Done today · {done.length}
            </h2>
            <div className="flex-1 h-px bg-border-default" />
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="text-11.5 text-text-muted hover:text-text-secondary transition-colors duration-120"
            >
              {showDone ? 'Hide' : 'Show'}
            </button>
          </div>
          {showDone && (
            <div className="flex flex-col gap-[9px]">
              {done.map((todo, index) => (
                <TodoRow key={todo.id} todo={todo} groupKey={today} index={index} compact />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function TodoListSkeleton() {
  return (
    <div className={COLUMN} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[52px] rounded-card bg-border-light animate-pulse" />
      ))}
    </div>
  );
}
