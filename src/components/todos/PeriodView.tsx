'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  daysOfWeek,
  formatDayLabel,
  fromISODate,
  periodFor,
  toISODate,
  todayISO,
  weekOfMonth,
  weeksOfMonth,
  type Period,
} from '@/lib/todos';
import {
  scrollHeightOf,
  scrollHostBy,
  scrollHostFor,
  scrollTopOf,
} from '@/lib/scrollHost';
import type { Todo, TodoGroups } from '@/types';
import { QuickAdd } from './QuickAdd';
import { OverdueGroup, TodoGroup } from './TodoGroup';
import { useTodoActions, useTodos } from './TodoProvider';

const FORWARD_MARGIN = '80px';
const BACKWARD_TRIGGER_PX = 8;
const MAX_REACH = 26;

export function PeriodView({
  unit,
  composeRef,
}: {
  unit: 'week' | 'month';
  composeRef?: React.RefObject<HTMLDivElement>;
}) {
  const { groups } = useTodos();
  const { loadRange } = useTodoActions();

  const [first, setFirst] = useState(0);
  const [last, setLast] = useState(0);

  const periods = useMemo(() => {
    const out: Period[] = [];
    for (let offset = first; offset <= last; offset++) out.push(periodFor(unit, offset));
    return out;
  }, [first, last, unit]);

  const rootRef = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const bottomSentinel = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    host.current = scrollHostFor(rootRef.current);
  }, []);

  // ── Scrollspy state ───────────────────────────────────────────────────────
  const [activeTitle, setActiveTitle] = useState(() => periodFor(unit, 0).title);
  const [activeIsNow, setActiveIsNow] = useState(true);
  const sectionHeaderRefs = useRef<Map<number, HTMLElement>>(new Map());
  const stickyBarRef = useRef<HTMLDivElement>(null);

  // Reset when switching week ↔ month
  useEffect(() => {
    setActiveTitle(periodFor(unit, 0).title);
    setActiveIsNow(true);
    sectionHeaderRefs.current.clear();
  }, [unit]);

  // Scroll listener: find which period header most recently passed the sticky bar
  useEffect(() => {
    const scrollEl = host.current;
    if (!scrollEl) return;

    const update = () => {
      const stickyH = stickyBarRef.current?.offsetHeight ?? 0;
      const containerTop = scrollEl.getBoundingClientRect().top;

      // Start from the first rendered period and advance whenever a header
      // has scrolled up past (or flush with) the sticky bar's bottom edge.
      let currentTitle = periods[0]?.title ?? activeTitle;
      let currentIsNow = periods[0]?.offset === 0;

      for (const period of periods) {
        const el = sectionHeaderRefs.current.get(period.offset);
        if (!el) continue;
        const elTop = el.getBoundingClientRect().top - containerTop;
        if (elTop <= stickyH + 2) {
          currentTitle = period.title;
          currentIsNow = period.offset === 0;
        }
      }

      setActiveTitle(currentTitle);
      setActiveIsNow(currentIsNow);
    };

    scrollEl.addEventListener('scroll', update, { passive: true });
    const frame = requestAnimationFrame(update);
    return () => {
      scrollEl.removeEventListener('scroll', update);
      cancelAnimationFrame(frame);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods]);

  // ── Prepend / scroll-correction ──────────────────────────────────────────
  const anchor = useRef<number | null>(null);
  const settling = useRef(false);

  useEffect(() => {
    setFirst(0);
    setLast(0);
    anchor.current = null;
    settling.current = false;
  }, [unit]);

  useLayoutEffect(() => {
    if (anchor.current === null) return;
    const delta = scrollHeightOf(host.current) - anchor.current;
    anchor.current = null;
    if (delta > 0) scrollHostBy(host.current, delta);
    const frame = requestAnimationFrame(() => {
      settling.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [first]);

  const extendUp = useCallback(() => {
    if (settling.current || first <= -MAX_REACH) return;
    settling.current = true;
    anchor.current = scrollHeightOf(host.current);
    setFirst(first - 1);
  }, [first]);

  const settlingDown = useRef(false);
  const extendDown = useCallback(() => {
    if (settlingDown.current || last >= MAX_REACH) return;
    settlingDown.current = true;
    setLast((l) => {
      const next = Math.min(l + 1, MAX_REACH);
      requestAnimationFrame(() => { settlingDown.current = false; });
      return next;
    });
  }, [last]);

  useEffect(() => {
    const bottom = bottomSentinel.current;
    if (!bottom || last >= MAX_REACH) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) extendDown();
      },
      { root: host.current, rootMargin: `0px 0px ${FORWARD_MARGIN} 0px` }
    );
    observer.observe(bottom);
    return () => observer.disconnect();
  }, [extendDown, last]);

  useEffect(() => {
    const top = topSentinel.current;
    if (!top || first <= -MAX_REACH) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        if (scrollTopOf(host.current) <= BACKWARD_TRIGGER_PX) return;
        extendUp();
      },
      { root: host.current }
    );
    observer.observe(top);
    return () => observer.disconnect();
  }, [extendUp, first]);

  useEffect(() => {
    for (const period of periods) {
      if (period.offset === 0) continue;
      loadRange(period.range.start, period.range.end);
    }
  }, [loadRange, periods]);

  return (
    <div ref={rootRef} className="w-full max-w-[920px] mx-auto flex flex-col">
      {/* ── Sticky header: scrollspy title + quick-add ─────────────────── */}
      <div
        ref={stickyBarRef}
        className="sticky top-0 z-10 px-8 pt-[26px] pb-4"
        style={{ background: 'var(--canvas-base, var(--bg-base))' }}
      >
        <header className="flex items-baseline gap-3 flex-wrap mb-3">
          <h2
            className="m-0 font-serif text-[22px] font-normal"
            style={{ letterSpacing: '-0.015em', color: 'var(--heading-color, var(--text-primary))' }}
          >
            {activeTitle}
          </h2>
          {activeIsNow && (
            <span className="text-10 font-semibold uppercase tracking-[0.08em] text-accent-blue-dark bg-accent-blue-bg rounded-full px-2 py-[3px]">
              Now
            </span>
          )}
        </header>

        <div ref={composeRef}>
          <QuickAdd
            placeholder="Add a to-do — type a date, or use the button under any day"
            showShortcut
          />
        </div>
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────── */}
      <div className="px-8 pb-8 flex flex-col density-stack">
        <OverdueGroup todos={groups.overdue} />

        <PeriodStep
          label={unit === 'week' ? 'Earlier weeks' : 'Earlier months'}
          direction="up"
          onClick={extendUp}
        />
        <div ref={topSentinel} aria-hidden="true" className="h-px -mt-px" />

        {periods.map((period) =>
          unit === 'week' ? (
            <WeekBlock
              key={period.offset}
              period={period}
              groups={groups}
              onHeaderRef={(el) => {
                if (el) sectionHeaderRefs.current.set(period.offset, el);
                else sectionHeaderRefs.current.delete(period.offset);
              }}
            />
          ) : (
            <MonthBlock
              key={period.offset}
              period={period}
              groups={groups}
              onHeaderRef={(el) => {
                if (el) sectionHeaderRefs.current.set(period.offset, el);
                else sectionHeaderRefs.current.delete(period.offset);
              }}
            />
          )
        )}

        <div ref={bottomSentinel} aria-hidden="true" className="h-px -mb-px" />

        <PeriodStep
          label={unit === 'week' ? 'Later weeks' : 'Later months'}
          direction="down"
          onClick={extendDown}
        />
      </div>
    </div>
  );
}

function PeriodStep({
  label,
  direction,
  onClick,
}: {
  label: string;
  direction: 'up' | 'down';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-center flex items-center gap-2 text-11.5 text-text-muted hover:text-accent-blue-dark transition-colors duration-120 py-1"
    >
      <span aria-hidden="true">{direction === 'up' ? '↑' : '↓'}</span>
      {label}
    </button>
  );
}

/* ── Section headers (remain as in-scroll dividers) ───────────────────────*/

function PeriodHeader({
  period,
  open,
  done,
  current,
}: {
  period: Period;
  open: number;
  done: number;
  current: boolean;
}) {
  return (
    <header className="flex items-baseline gap-3 flex-wrap pt-1.5">
      <h2
        className="m-0 font-serif text-[22px] font-normal text-[color:var(--heading-color)]"
        style={{ letterSpacing: '-0.015em' }}
      >
        {period.title}
      </h2>
      {current && (
        <span className="text-10 font-semibold uppercase tracking-[0.08em] text-accent-blue-dark bg-accent-blue-bg rounded-full px-2 py-[3px]">
          Now
        </span>
      )}
      <span className="text-12 text-text-muted">{period.span}</span>
      <div className="flex-1 min-w-[24px] h-px bg-border-default self-center" />
      <span className="text-11.5 text-text-muted tabular-nums">
        {open} open{done > 0 && ` · ${done} done`}
      </span>
    </header>
  );
}

function tally(groups: TodoGroups, days: string[]) {
  let open = 0;
  let done = 0;
  for (const day of days) {
    open += (groups.dated[day] || []).length;
    done += (groups.done[day] || []).length;
  }
  return { open, done };
}

/* ── Week ─────────────────────────────────────────────────────────────────*/

function WeekBlock({
  period,
  groups,
  onHeaderRef,
}: {
  period: Period;
  groups: TodoGroups;
  onHeaderRef?: React.RefCallback<HTMLDivElement>;
}) {
  const today = todayISO();
  const days = daysOfWeek(period.start);
  const { open, done } = tally(groups, days);

  return (
    <section className="flex flex-col density-stack">
      <div ref={onHeaderRef}>
        <PeriodHeader period={period} open={open} done={done} current={period.offset === 0} />
      </div>
      {days.map((day) => (
        <DaySection key={day} day={day} today={today} groups={groups} />
      ))}
    </section>
  );
}

/* ── Month ────────────────────────────────────────────────────────────────*/

function MonthBlock({
  period,
  groups,
  onHeaderRef,
}: {
  period: Period;
  groups: TodoGroups;
  onHeaderRef?: React.RefCallback<HTMLDivElement>;
}) {
  const today = todayISO();
  const weeks = weeksOfMonth(period.start);
  const monthIndex = period.start.getMonth();
  const allDays = weeks.flatMap((monday) => daysOfWeek(monday));
  const { open, done } = tally(groups, allDays);

  return (
    <section className="flex flex-col density-stack">
      <div ref={onHeaderRef}>
        <PeriodHeader period={period} open={open} done={done} current={period.offset === 0} />
      </div>

      {weeks.map((monday) => {
        const days = daysOfWeek(monday);
        const week = tally(groups, days);
        const iso = toISODate(monday);
        const label =
          monday.getMonth() === monthIndex
            ? `Week ${weekOfMonth(monday)}`
            : `${monday.toLocaleDateString('en-GB', { month: 'short' })} · Week ${weekOfMonth(monday)}`;
        const holdsToday = days.includes(today);

        return (
          <section key={iso} className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <h3
                className={`m-0 font-mono text-10 font-semibold uppercase tracking-[0.1em] ${
                  holdsToday ? 'text-accent-blue-dark' : 'text-text-secondary'
                }`}
              >
                {label}
              </h3>
              <span className="text-11 text-text-faint">
                {monday.toLocaleDateString('en-GB', { day: 'numeric' })}–
                {fromISODate(days[6]).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
              <div className="flex-1 h-px bg-border-light" />
              {week.open + week.done > 0 && (
                <span className="text-11 text-text-faint tabular-nums">
                  {week.open} open{week.done > 0 && ` · ${week.done} done`}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4 pl-0 md:pl-3 md:border-l md:border-border-light">
              {days.map((day) => (
                <DaySection key={day} day={day} today={today} groups={groups} dense />
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}

/* ── Day ──────────────────────────────────────────────────────────────────*/

function DaySection({
  day,
  today,
  groups,
  dense = false,
}: {
  day: string;
  today: string;
  groups: TodoGroups;
  dense?: boolean;
}) {
  const open: Todo[] = groups.dated[day] || [];
  const done: Todo[] = groups.done[day] || [];

  return (
    <TodoGroup
      groupKey={day}
      title={formatDayLabel(day, today)}
      tone={day === today ? 'today' : 'default'}
      todos={[...open, ...done]}
      done={[]}
      showDone={false}
      compact
      quiet={dense && open.length === 0 && done.length === 0}
      addRow={{ dueDate: day, label: `Add to ${formatDayLabel(day, today)}` }}
    />
  );
}
