/**
 * Shared to-do logic — pure, framework-free, and imported by both the API
 * routes and the client components so the two can never disagree about what
 * "this week" means or where a dropped row lands.
 *
 * Deliberately no 'use client': the API routes need `todayISO`, `weekRange`
 * and the position maths as much as the list does.
 */

import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isValid,
  parse,
  parseISO,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import type {
  Todo,
  TodoAssignment,
  TodoDoneBehavior,
  TodoFilter,
  TodoPreferences,
  SubtaskMode,
} from '@/types';

/* ── Dates ────────────────────────────────────────────────────────────────
 *
 * `due_date` is a Postgres `date`, so it is a calendar day with no zone. Every
 * conversion here goes through the local calendar rather than `new Date(iso)`,
 * which parses a bare yyyy-MM-dd as UTC midnight and lands on the previous day
 * for anyone west of Greenwich — the bug that would make "Today" empty all
 * afternoon in Jakarta and all morning in New York.
 */

export const ISO_DATE = 'yyyy-MM-dd';

/** Parses a `date` column value in the local calendar, not as UTC midnight. */
export function fromISODate(value: string): Date {
  return parse(value, ISO_DATE, new Date());
}

export function toISODate(date: Date): string {
  return format(date, ISO_DATE);
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Monday–Sunday, matching the calendar grid and the "rest of week" count. */
export function weekRange(from: Date = new Date()): { start: string; end: string } {
  return {
    start: toISODate(startOfWeek(from, { weekStartsOn: 1 })),
    end: toISODate(endOfWeek(from, { weekStartsOn: 1 })),
  };
}

export function monthRange(from: Date = new Date()): { start: string; end: string } {
  return { start: toISODate(startOfMonth(from)), end: toISODate(endOfMonth(from)) };
}

/**
 * The inclusive date window a filter covers, or null for `all`.
 *
 * Overdue is not part of any window — it is pinned above the groups under
 * every filter, so the API adds it separately.
 */
export function filterRange(filter: TodoFilter, from: Date = new Date()) {
  if (filter === 'today') return { start: toISODate(from), end: toISODate(from) };
  if (filter === 'week') return weekRange(from);
  if (filter === 'month') return monthRange(from);
  return null;
}

/** "Tue 18 Aug", or "Today" / "Tomorrow" / "Yesterday" when it is one of those. */
export function formatDueLabel(iso: string, today: string = todayISO()): string {
  if (iso === today) return 'Today';
  const date = fromISODate(iso);
  const todayDate = fromISODate(today);
  if (iso === toISODate(addDays(todayDate, 1))) return 'Tomorrow';
  if (iso === toISODate(addDays(todayDate, -1))) return 'Yesterday';
  return format(date, 'EEE d MMM');
}

/**
 * How far behind a carried-over to-do is, in the shortest honest wording.
 *
 * Days rather than a date, because the question the row is answering is "how
 * long has this been sitting there" — and a count is easier to triage against
 * than working out how far back "Tue 12 Aug" was. Kept short: it renders in a
 * narrow gutter beside the row.
 */
export function overdueAge(iso: string, today: string = todayISO()): string {
  const days = differenceInCalendarDays(fromISODate(today), fromISODate(iso));
  if (days <= 0) return '';
  if (days === 1) return '1 day';
  if (days < 14) return `${days} days`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? '1 week' : `${weeks} weeks`;
}

/** The long form used as the Today page's <h1> — "Tuesday, 18 August". */
export function formatDayHeading(iso: string): string {
  return format(fromISODate(iso), 'EEEE, d MMMM');
}

/** Trims Postgres's `HH:mm:ss` down to the `HH:mm` the design shows. */
export function formatTime(time: string | null): string | null {
  if (!time) return null;
  return time.slice(0, 5);
}

/** "45m", "1 h 45 m" — the estimate chip and the "roughly …" sub-line. */
export function formatEstimate(minutes: number | null | undefined, long = false): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (long) {
    if (!hours) return `${mins} m`;
    return mins ? `${hours} h ${mins} m` : `${hours} h`;
  }
  if (!hours) return `${mins}m`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Overdue means the day has passed, or the day is today and the time has.
 * A to-do with a date but no time is never overdue on its own day.
 */
export function isOverdue(todo: Todo, now: Date = new Date()): boolean {
  if (todo.is_completed || !todo.due_date) return false;
  const today = toISODate(now);
  if (todo.due_date < today) return true;
  if (todo.due_date > today || !todo.due_time) return false;
  return formatTime(todo.due_time)! < format(now, 'HH:mm');
}

/* ── Ordering ─────────────────────────────────────────────────────────────
 *
 * Fractional positions: dropping between two rows writes the midpoint, so a
 * reorder is a single UPDATE regardless of how long the group is, and a
 * cross-date drag is the same UPDATE with a new due_date attached.
 */

/** Gap between appended rows. Wide enough to subdivide for a long time. */
export const POSITION_STEP = 1024;

/**
 * A position that sorts between `before` and `after`.
 *
 * Repeated midpoints eventually exhaust float precision — after ~50 drops into
 * the same gap the midpoint equals one of its neighbours and the order goes
 * unstable. `needsRebalance` detects that so the caller can renumber the group
 * once instead of silently shuffling rows.
 */
export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return 0;
  if (before === null) return after! - POSITION_STEP;
  if (after === null) return before + POSITION_STEP;
  return (before + after) / 2;
}

export function needsRebalance(before: number | null, after: number | null): boolean {
  if (before === null || after === null) return false;
  const mid = (before + after) / 2;
  return mid === before || mid === after;
}

/** Renumbers a group onto clean multiples of POSITION_STEP. */
export function rebalance(todos: Todo[]): { id: string; position: number }[] {
  return todos.map((todo, i) => ({ id: todo.id, position: (i + 1) * POSITION_STEP }));
}

export function sortByPosition(todos: Todo[]): Todo[] {
  return [...todos].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return a.created_at < b.created_at ? -1 : 1;
  });
}

/* ── Preferences ──────────────────────────────────────────────────────────
 *
 * Null in the database means "never chosen", not "off". Resolving the defaults
 * in one place keeps a missing column from reading as a disabled feature.
 */

export interface ResolvedTodoPreferences {
  assignment: TodoAssignment;
  doneBehavior: TodoDoneBehavior;
  subtaskMode: SubtaskMode;
  showEstimates: boolean;
  showProgress: boolean;
  /** null = no cap; Today shows everything. */
  todayCap: number | null;
  rollover: boolean;
}

export const TODO_DEFAULTS: ResolvedTodoPreferences = {
  assignment: 'today',
  doneBehavior: 'stay',
  subtaskMode: 'independent',
  showEstimates: true,
  showProgress: true,
  todayCap: 6,
  rollover: true,
};

/**
 * Takes a loose record rather than `Partial<TodoPreferences>`: the caller is
 * either the raw `users` row from the API or the preferences object, where
 * these columns are typed as the plain `string | boolean | number | null` the
 * database returns. Every value is narrowed here, so an unrecognised one falls
 * back to the default instead of reaching the UI as a broken enum.
 */
export function resolveTodoPreferences(
  prefs: Record<string, unknown> | null | undefined
): ResolvedTodoPreferences {
  const p = (prefs ?? {}) as Partial<TodoPreferences>;
  return {
    assignment:
      p.todo_default_assignment === 'unassigned' || p.todo_default_assignment === 'today'
        ? p.todo_default_assignment
        : TODO_DEFAULTS.assignment,
    doneBehavior:
      p.todo_done_behavior === 'section' || p.todo_done_behavior === 'stay'
        ? p.todo_done_behavior
        : TODO_DEFAULTS.doneBehavior,
    subtaskMode:
      p.todo_subtask_mode === 'dependent' || p.todo_subtask_mode === 'independent'
        ? p.todo_subtask_mode
        : TODO_DEFAULTS.subtaskMode,
    showEstimates: p.todo_show_estimates ?? TODO_DEFAULTS.showEstimates,
    showProgress: p.todo_show_progress ?? TODO_DEFAULTS.showProgress,
    // The cap is stored as a number so it can be changed later without another
    // migration; 0 is the off switch the toggle writes.
    todayCap: p.todo_today_cap === 0 ? null : p.todo_today_cap ?? TODO_DEFAULTS.todayCap,
    rollover: p.todo_rollover ?? TODO_DEFAULTS.rollover,
  };
}

/* ── Sub-tasks ────────────────────────────────────────────────────────────*/

export function subtaskProgress(todo: Todo): { done: number; total: number } | null {
  const subs = todo.subtasks;
  if (!subs || subs.length === 0) return null;
  return { done: subs.filter((s) => s.is_completed).length, total: subs.length };
}

/**
 * Whether the parent's own checkbox is locked.
 *
 * Only `dependent` parents lock, and only while a sub-task is still open —
 * an independent parent can be ticked whenever the user likes, which is the
 * default precisely so the feature never blocks anyone.
 */
export function isParentLocked(todo: Todo): boolean {
  if (todo.subtask_mode !== 'dependent') return false;
  const progress = subtaskProgress(todo);
  return !!progress && progress.done < progress.total;
}

/* ── Quick-add parsing ────────────────────────────────────────────────────
 *
 * Typing is the whole interaction: "email Andra fri 3pm ~20m" should file
 * itself. Every match is echoed back as a dismissible chip, so a wrong guess
 * costs one click rather than a re-type — which is why this leans towards
 * recognising less rather than guessing at ambiguous input.
 */

export interface ParsedQuickAdd {
  title: string;
  due_date: string | null;
  due_time: string | null;
  estimate_minutes: number | null;
  /** Human-readable echo for the chips, e.g. ['Fri 22 Aug', '15:00', '20m']. */
  matches: { kind: 'date' | 'time' | 'estimate'; label: string; text: string; implied?: boolean }[];
}

/**
 * The time a dated to-do gets when none was typed.
 *
 * End of the working day, which is what every to-do app that has this
 * behaviour settles on: "today" almost always means "before I stop", and a
 * to-do with a time sorts and reminds properly while one without floats. It is
 * offered rather than imposed — it arrives as a dismissible chip like every
 * other guess quick add makes, so one click puts it back to no time at all.
 */
export const DEFAULT_DUE_TIME = '17:00';

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAY_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** The next occurrence of `weekday`, never today — "friday" said on a Friday means next Friday. */
function nextWeekday(weekday: number, from: Date): Date {
  const delta = (weekday - from.getDay() + 7) % 7;
  return addDays(from, delta === 0 ? 7 : delta);
}

export function parseQuickAdd(input: string, now: Date = new Date()): ParsedQuickAdd {
  const result: ParsedQuickAdd = {
    title: input,
    due_date: null,
    due_time: null,
    estimate_minutes: null,
    matches: [],
  };

  let text = input;

  /** Removes the matched phrase from the title and records the chip. */
  function consume(match: string, kind: 'date' | 'time' | 'estimate', label: string) {
    text = text.replace(match, ' ');
    result.matches.push({ kind, label, text: match.trim() });
  }

  // Estimate — "~20m", "~1h30", "~2h". The tilde is required so a title like
  // "run 5k in 30m" is not silently turned into an estimate.
  const estimate = text.match(/~\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m?)?/i);
  if (estimate && (estimate[1] || estimate[2])) {
    const hours = parseInt(estimate[1] || '0', 10);
    const mins = parseInt(estimate[2] || '0', 10);
    const total = hours * 60 + mins;
    if (total > 0 && total <= 1440) {
      result.estimate_minutes = total;
      consume(estimate[0], 'estimate', formatEstimate(total)!);
    }
  }

  // Time — "3pm", "15:00", "9.30am".
  const time = text.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b|\b(\d{1,2}):(\d{2})\b/i);
  if (time) {
    let hour: number;
    let minute: number;
    if (time[3]) {
      hour = parseInt(time[1], 10) % 12;
      minute = parseInt(time[2] || '0', 10);
      if (time[3].toLowerCase() === 'pm') hour += 12;
    } else {
      hour = parseInt(time[4], 10);
      minute = parseInt(time[5], 10);
    }
    if (hour <= 23 && minute <= 59) {
      result.due_time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
      consume(time[0], 'time', result.due_time);
    }
  }

  // Date — keywords first, then weekday names, then an explicit d/M.
  const lower = text.toLowerCase();
  const keyword = lower.match(/\b(today|tomorrow|tonight|next week|weekend)\b/);
  if (keyword) {
    const map: Record<string, Date> = {
      today: now,
      tonight: now,
      tomorrow: addDays(now, 1),
      'next week': addDays(startOfWeek(now, { weekStartsOn: 1 }), 7),
      weekend: nextWeekday(6, now),
    };
    const date = map[keyword[1]];
    result.due_date = toISODate(date);
    consume(text.slice(keyword.index!, keyword.index! + keyword[0].length), 'date', formatDueLabel(result.due_date, toISODate(now)));
    // "tonight" carries an implied evening time when none was typed.
    if (keyword[1] === 'tonight' && !result.due_time) result.due_time = '19:00';
  } else {
    const weekday = lower.match(
      new RegExp(`\\b(?:(next)\\s+)?(${WEEKDAYS.join('|')}|${WEEKDAY_SHORT.join('|')})\\b`)
    );
    if (weekday) {
      const name = weekday[2];
      const index = WEEKDAYS.indexOf(name) >= 0 ? WEEKDAYS.indexOf(name) : WEEKDAY_SHORT.indexOf(name);
      let date = nextWeekday(index, now);
      if (weekday[1]) date = addDays(date, 7);
      result.due_date = toISODate(date);
      consume(text.slice(weekday.index!, weekday.index! + weekday[0].length), 'date', formatDueLabel(result.due_date, toISODate(now)));
    } else {
      // "18/8", "18 aug" — day first, matching the app's en-GB date display.
      const explicit = text.match(/\b(\d{1,2})[\/\s-]([a-z]{3,}|\d{1,2})\b/i);
      if (explicit) {
        const parsed = parse(
          `${explicit[1]} ${explicit[2]} ${now.getFullYear()}`,
          /\d/.test(explicit[2]) ? 'd M yyyy' : 'd MMM yyyy',
          now
        );
        if (isValid(parsed)) {
          // A date already gone this year means next year — "3 jan" typed in
          // December is January, not ten months ago.
          const date = toISODate(parsed) < toISODate(now) ? addMonths(parsed, 12) : parsed;
          result.due_date = toISODate(date);
          consume(explicit[0], 'date', formatDueLabel(result.due_date, toISODate(now)));
        }
      }
    }
  }

  /*
   * A date with no time gets the end-of-day default. Pushed as an ordinary
   * `time` match so the chip row shows it and one click removes it — the user
   * sees what was assumed rather than discovering it in the detail panel.
   */
  if (result.due_date && !result.due_time) {
    result.due_time = DEFAULT_DUE_TIME;
    result.matches.push({
      kind: 'time',
      label: DEFAULT_DUE_TIME,
      text: '',
      implied: true,
    });
  }

  result.title = text.replace(/\s+/g, ' ').trim();
  // Every token turned out to be metadata — keep the raw input rather than
  // saving a to-do with no title at all.
  if (!result.title) {
    return { title: input.trim(), due_date: null, due_time: null, estimate_minutes: null, matches: [] };
  }
  return result;
}

/** Validates a `yyyy-MM-dd` string before it reaches the database. */
export function isISODate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return isValid(parseISO(value));
}

/** Validates `HH:mm` or `HH:mm:ss`. */
export function isISOTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);
}
