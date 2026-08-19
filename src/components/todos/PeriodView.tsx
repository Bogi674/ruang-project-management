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

/**
 * The Week and Month lists.
 *
 * Both are the same thing at two scales: a titled period, every day inside it
 * laid out whether or not it holds anything, and no end in either direction —
 * scrolling past the top or bottom reveals the neighbouring period.
 *
 * Every day is rendered even when empty, and that is the point rather than an
 * oversight. A list that only shows the days you happen to have filled gives
 * you no sense of the shape of the week, and gives you nowhere to put Friday's
 * work except a date picker. With the day always present, adding to Friday is
 * one click on Friday.
 */

/**
 * How far below the fold to reach before loading the next period.
 *
 * Only the *forward* sentinel gets a margin. The backward one has to be
 * genuinely on screen before it fires: it sits near the top of the scroller, so
 * with a margin it would be intersecting the moment the page mounted and the
 * list would walk backwards through the calendar on its own before the user had
 * touched anything.
 *
 * Kept small (80px) so only one period is loaded at a time — a larger value
 * caused the observer to fire repeatedly on the rebuilt sentinel and load
 * several weeks in advance even when the user was scrolling slowly.
 */
const FORWARD_MARGIN = '80px';

/**
 * How far from the top edge counts as "asking for the previous period".
 *
 * The sentinel being on screen is not enough on its own. Prepending corrects the
 * scroll offset by the height of what was added, and that correction is only
 * *exact* if nothing else moved in the same frame; a few pixels of drift left
 * the sentinel still intersecting, the observer fired again, and one flick of
 * the wheel walked the list back six months. Requiring real distance from the
 * top absorbs the drift, and the settle guard below makes sure each request is
 * answered once.
 */
const BACKWARD_TRIGGER_PX = 8;

/**
 * The furthest the range will reach in either direction, in periods.
 *
 * Half a year of weeks, or two years of months. Not a product limit so much as
 * a stop on the auto-extension: if a period ever renders at no height the
 * sentinel would stay in range and the loop would not settle, and an endless
 * list is a worse failure than one that stops.
 */
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

  // Offsets from the current period, inclusive. Starts as just this one.
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

  /*
   * The box that actually scrolls.
   *
   * `/todo` scrolls a region inside the page rather than the document, so every
   * measurement here — the height to anchor against, the offset to test, the
   * observer's root — has to be that region. Resolved from the DOM instead of
   * passed in as a prop so the component still works unchanged if it is ever
   * mounted somewhere that lets the document scroll: `null` means "the
   * document", and every helper in lib/scrollHost.ts accepts it.
   */
  const host = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    host.current = scrollHostFor(rootRef.current);
  }, []);

  /*
   * Prepending moves everything below it down by the height of what was added,
   * which would throw the reader to a different part of the list mid-scroll.
   * The scroller's height is measured before the new period renders and the
   * difference is added back to the scroll offset in a layout effect, so the
   * content under the pointer does not move at all.
   *
   * The correction has to be instant. Animated, it is not a correction: the
   * offset stays wrong for the length of the animation, the sentinel it was
   * meant to move off screen is still intersecting, and the list asks for
   * another period — and another — for as long as the animation lasts. That is
   * why `scroll-behavior: smooth` is no longer set on the document (see
   * globals.css) and why the scroll goes through `scrollHostBy`, which passes
   * `behavior: 'instant'` whatever the stylesheet says.
   */
  const anchor = useRef<number | null>(null);

  /*
   * One period per request.
   *
   * `settling` is held from the moment a prepend is asked for until the frame
   * after its correction has been applied. Without it the observer, which is
   * rebuilt on every range change and therefore re-reports the current state,
   * could ask again before the correction it is reacting to had happened —
   * turning one gesture into a run of prepends with nothing to stop it but
   * MAX_REACH.
   */
  const settling = useRef(false);

  // A filter switch remounts with a fresh range rather than keeping however far
  // the previous one had been scrolled. The extension bookkeeping resets with
  // it — a range that no longer exists must not leave the guard held.
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
    // Released a frame later, once the corrected offset is what the next
    // intersection callback will read.
    const frame = requestAnimationFrame(() => {
      settling.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [first]);

  const extendUp = useCallback(() => {
    // Clamped before the guard is taken, not after: at the end of the range
    // `setFirst` would be a no-op, no layout effect would run, and a `settling`
    // taken here would never be released.
    if (settling.current || first <= -MAX_REACH) return;
    settling.current = true;
    anchor.current = scrollHeightOf(host.current);
    setFirst(first - 1);
  }, [first]);

  /*
   * Forward extension also needs a one-period-at-a-time guard.
   *
   * When the observer is rebuilt after a period is appended, it re-evaluates
   * immediately. With the old 700px margin that re-evaluation fired again
   * before the new content had actually pushed the sentinel below the fold,
   * loading two or three periods in rapid succession even on a slow scroll.
   * `settlingDown` holds from the append until one animation frame later,
   * giving the browser a chance to lay out the new period and move the
   * sentinel out of the trigger zone.
   */
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

  /*
   * Both observers are rebuilt whenever the range changes, and that is
   * load-bearing rather than sloppy dependencies.
   *
   * An IntersectionObserver only calls back when an element *crosses* a
   * threshold. The sentinel does not move relative to the scroller when a
   * period is appended below it — it is still the last thing in the list — so
   * it never re-crosses and a single observer would hand back exactly one extra
   * period and then go quiet. Re-observing re-evaluates the current state and
   * fires again if it is still in range, which is also what fills a viewport
   * taller than one period on first paint.
   */
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
        // The offset test is the second half of the guard: at rest the sentinel
        // sits near the top of the list and is visible by definition, so
        // reacting to intersection alone would extend backwards on mount rather
        // than on a gesture.
        if (!entries.some((e) => e.isIntersecting)) return;
        if (scrollTopOf(host.current) <= BACKWARD_TRIGGER_PX) return;
        extendUp();
      },
      { root: host.current }
    );
    observer.observe(top);
    return () => observer.disconnect();
  }, [extendUp, first]);

  // Each period asks the server for its own slice. Offset 0 is already in the
  // first payload, and loadRange skips any range it has fetched before.
  useEffect(() => {
    for (const period of periods) {
      if (period.offset === 0) continue;
      loadRange(period.range.start, period.range.end);
    }
  }, [loadRange, periods]);

  return (
    <div
      ref={rootRef}
      className="w-full max-w-[920px] mx-auto px-8 pt-[26px] pb-8 flex flex-col density-stack"
    >
      <div ref={composeRef}>
        <QuickAdd
          placeholder="Add a to-do — type a date, or use the button under any day"
          showShortcut
        />
      </div>

      {/* Carried-over work is pinned to the top of the list, not filed under
          the day it slipped from — it is the one thing that must not scroll
          away with its period. */}
      <OverdueGroup todos={groups.overdue} />

      {/*
        The buttons are not a fallback for the scroll — they are the guarantee.
        A list short enough not to scroll can never fire a sentinel, and on a
        trackpad the backward one needs the page to be scrolled at all, so
        without these the previous week would simply be unreachable for anyone
        whose week is quiet.
      */}
      <PeriodStep
        label={unit === 'week' ? 'Earlier weeks' : 'Earlier months'}
        direction="up"
        onClick={extendUp}
      />
      <div ref={topSentinel} aria-hidden="true" className="h-px -mt-px" />

      {periods.map((period) =>
        unit === 'week' ? (
          <WeekBlock key={period.offset} period={period} groups={groups} />
        ) : (
          <MonthBlock key={period.offset} period={period} groups={groups} />
        )
      )}

      <div ref={bottomSentinel} aria-hidden="true" className="h-px -mb-px" />

      <PeriodStep
        label={unit === 'week' ? 'Later weeks' : 'Later months'}
        direction="down"
        onClick={extendDown}
      />
    </div>
  );
}

/** The reach-further control at either end of the range. */
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

/* ── Headers ──────────────────────────────────────────────────────────────
 *
 * A period header is a serif line and a caption, matching the Today page's
 * <h1> rather than the mono section labels the day groups use. That difference
 * is what makes the hierarchy readable when a dozen days are on screen: one
 * typeface says "period", the other says "day inside it".
 */
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

/** Counts the open and done rows across a set of days. */
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

function WeekBlock({ period, groups }: { period: Period; groups: TodoGroups }) {
  const today = todayISO();
  const days = daysOfWeek(period.start);
  const { open, done } = tally(groups, days);

  return (
    <section className="flex flex-col density-stack">
      <PeriodHeader period={period} open={open} done={done} current={period.offset === 0} />
      {days.map((day) => (
        <DaySection key={day} day={day} today={today} groups={groups} />
      ))}
    </section>
  );
}

/* ── Month ────────────────────────────────────────────────────────────────
 *
 * A month is its weeks, and each week is its days — the same blocks the Week
 * view uses, one level down. Rendering a month as a flat run of thirty day
 * headings loses the only structure anyone actually plans against.
 */
function MonthBlock({ period, groups }: { period: Period; groups: TodoGroups }) {
  const today = todayISO();
  const weeks = weeksOfMonth(period.start);
  const monthIndex = period.start.getMonth();
  const allDays = weeks.flatMap((monday) => daysOfWeek(monday));
  const { open, done } = tally(groups, allDays);

  return (
    <section className="flex flex-col density-stack">
      <PeriodHeader period={period} open={open} done={done} current={period.offset === 0} />

      {weeks.map((monday) => {
        const days = daysOfWeek(monday);
        const week = tally(groups, days);
        const iso = toISODate(monday);
        // A week whose Monday sits in the previous month is named with that
        // month, so "Week 4" never means two different weeks on one screen.
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

/**
 * One day, always rendered.
 *
 * `addRow` is never null, so an empty day is not a dead heading — it is a
 * labelled drop target with its own add button. That is what makes "put this
 * under Saturday" a click rather than a date picker.
 */
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

  // In period views (week/month) done items appear inline with strikethrough
  // rather than in a separate collapsible "Done" section — the day is already
  // a small unit and a second header inside it adds hierarchy without meaning.
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
