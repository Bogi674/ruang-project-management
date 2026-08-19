'use client';

import { useState } from 'react';
import { todayISO } from '@/lib/todos';
import { EmptyState } from './EmptyState';
import { PeriodView } from './PeriodView';
import { QuickAdd } from './QuickAdd';
import { OverdueGroup, TodoGroup } from './TodoGroup';
import { TodoRow } from './TodoRow';
import { TodayHeader } from './TodayHeader';
import { AnytimeColumn } from './AnytimeColumn';
import { useTodos } from './TodoProvider';

/**
 * /todo.
 *
 * Four ranges, three shapes. Today is one day with a headline; Week and Month
 * are open-ended period lists (see PeriodView); All is the two-column overview.
 *
 * `COLUMN` is the one measure they share. Today used to be centred in an
 * 820–920px column while Week and Month ran the full width of the window, so
 * switching range re-flowed every row and the same to-do was a different width
 * depending on which tab you were on.
 */
const COLUMN = 'w-full max-w-[920px] mx-auto px-4 md:px-8 pt-[26px] pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-8 flex flex-col density-stack';

export function TodoListView({ composeRef }: { composeRef?: React.RefObject<HTMLDivElement> }) {
  const { groups, filter, loading } = useTodos();

  if (loading && Object.keys(groups.dated).length === 0 && groups.unassigned.length === 0) {
    return <TodoListSkeleton />;
  }

  if (filter === 'today') return <TodayView composeRef={composeRef} />;
  if (filter === 'week') return <PeriodView unit="week" composeRef={composeRef} />;
  if (filter === 'month') return <PeriodView unit="month" composeRef={composeRef} />;
  return <AllView composeRef={composeRef} />;
}

/* ── All ──────────────────────────────────────────────────────────────────
 *
 * Two columns, 60/40. Anytime is not a sidebar here — it is the other half of
 * the page, because All is the only range where undated work is the thing you
 * came to look at. At 300px it was a margin note; at 40% it is a list you can
 * actually work out of.
 */
function AllView({ composeRef }: { composeRef?: React.RefObject<HTMLDivElement> }) {
  const { groups } = useTodos();
  const today = todayISO();
  const dates = Object.keys(groups.dated).sort();

  return (
    <div className="flex flex-col md:flex-row md:items-start w-full max-w-[1320px] mx-auto">
      {/* On a phone the two columns stack, and Anytime goes first — the same
          "never bury it" reasoning that gave it a column in the first place. */}
      <div className="md:hidden order-first w-full px-8 pt-[26px]">
        <TodoGroup
          groupKey=""
          title={`Anytime · ${groups.unassigned.length}`}
          todos={groups.unassigned}
          compact
          cap={5}
          addRow={{ dueDate: null, label: 'Add without a date' }}
        />
      </div>

      <div className="md:basis-[60%] md:min-w-0 flex-1 px-8 pt-[26px] pb-8 flex flex-col density-stack">
        <div ref={composeRef}>
          <QuickAdd
            placeholder="Add a to-do — type a date, or leave it for Anytime"
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
            addRow={{ dueDate: date, label: 'Add here' }}
          />
        ))}

        {dates.length === 0 && groups.overdue.length === 0 && (
          <EmptyState variant={groups.counts.total === 0 ? 'nothing-at-all' : 'nothing-in-range'} />
        )}
      </div>

      <div className="hidden md:block md:basis-[40%] md:min-w-0">
        <AnytimeColumn todos={groups.unassigned} />
      </div>
    </div>
  );
}

/* ── Today ────────────────────────────────────────────────────────────────*/

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
        Anytime is shown on Today as well, folded to a few rows. Without it
        Today is the one range with no `groupKey=""` drop target on screen, so a
        to-do could be dragged onto a date from anywhere but never back off one
        — and "clear the date" is half of what dragging is for.
      */}
      {groups.unassigned.length > 0 && (
        <TodoGroup
          groupKey=""
          title="Anytime"
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
