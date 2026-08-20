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

const COLUMN_SCROLL_PB = 'pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-8';

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

/* ── All ──────────────────────────────────────────────────────────────────*/

function AllView({ composeRef }: { composeRef?: React.RefObject<HTMLDivElement> }) {
  const { groups } = useTodos();
  const today = todayISO();
  const dates = Object.keys(groups.dated).sort();

  return (
    <div className="flex flex-col md:flex-row md:items-start w-full max-w-[1320px] mx-auto">
      {/* Mobile: Anytime goes first */}
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

      <div className="md:basis-[60%] md:min-w-0 flex-1 flex flex-col">
        {/* Sticky quick-add */}
        <div
          className="sticky top-0 z-10 px-8 pt-[26px] pb-4 backdrop-blur-md border-b border-border-light"
          style={{ background: 'color-mix(in srgb, var(--canvas-base, var(--bg-base)) 80%, transparent)' }}
        >
          <div ref={composeRef}>
            <QuickAdd
              placeholder="Add a to-do — type a date, or leave it for Anytime"
              showShortcut
            />
          </div>
        </div>

        {/* Scrollable content */}
        <div className={`px-8 ${COLUMN_SCROLL_PB} flex flex-col density-stack`}>
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
      </div>

      <div className="hidden md:block md:basis-[40%] md:min-w-0">
        <AnytimeColumn todos={groups.unassigned} />
      </div>
    </div>
  );
}

/* ── Today ────────────────────────────────────────────────────────────────*/

function TodayView({ composeRef }: { composeRef?: React.RefObject<HTMLDivElement> }) {
  const { groups } = useTodos();
  const today = todayISO();
  const [showDone, setShowDone] = useState(true);

  const open = groups.dated[today] || [];
  const done = groups.done[today] || [];
  const overdue = groups.overdue;

  return (
    <div className="w-full max-w-[920px] mx-auto flex flex-col">
      {/* Sticky header: date headline + progress + quick-add */}
      <div
        className="sticky top-0 z-10 px-4 md:px-8 pt-[26px] pb-4 backdrop-blur-md border-b border-border-light"
        style={{ background: 'color-mix(in srgb, var(--canvas-base, var(--bg-base)) 80%, transparent)' }}
      >
        <TodayHeader open={[...overdue, ...open]} done={done} />
        <div ref={composeRef}>
          <QuickAdd showShortcut />
        </div>
      </div>

      {/* Scrollable content */}
      <div className={`px-4 md:px-8 ${COLUMN_SCROLL_PB} flex flex-col density-stack`}>
        {open.length > 0 ? (
          <TodoGroup
            groupKey={today}
            title={`Today · ${open.length}`}
            tone="today"
            todos={open}
            done={[]}
            cap={null}
            addRow={null}
          />
        ) : overdue.length === 0 ? (
          <EmptyState
            variant={done.length > 0 ? 'all-done' : 'nothing-today'}
            doneCount={done.length}
            unassignedCount={groups.unassigned.length}
          />
        ) : null}

        <OverdueGroup todos={overdue} />

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
    </div>
  );
}

function TodoListSkeleton() {
  return (
    <div
      className="w-full max-w-[920px] mx-auto px-4 md:px-8 pt-[26px] pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-8 flex flex-col density-stack"
      aria-hidden="true"
    >
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[52px] rounded-card bg-border-light animate-pulse" />
      ))}
    </div>
  );
}
