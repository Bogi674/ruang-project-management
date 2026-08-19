import type { SupabaseClient } from '@supabase/supabase-js';
import { filterRange, fromISODate, monthRange, sortByPosition, todayISO, weekRange } from './todos';
import type { Todo, TodoFilter, TodoGroups } from '@/types';

/**
 * Loading and grouping to-dos.
 *
 * Shared by `GET /api/todos` and the `/todo` server component so the first
 * paint and every later refetch are produced by the same code — the page
 * server-renders the active filter the way `home/page.tsx` does, and the
 * client then takes over. Two implementations of "what belongs in Today"
 * would drift apart within a week.
 */

/**
 * Everything a to-do row needs to render, in one query.
 *
 * Column lists rather than `*` on the embedded resources. PostgREST resolves
 * every embed as its own lateral join and serialises whatever it is asked for,
 * so `space:spaces(*)` and `file:files(*)` were shipping a dozen columns per
 * row that nothing on screen reads — on a month view that is the difference
 * between a small response and a slow one.
 */
/* One string literal, not a concatenation: supabase-js parses the select at the
 * type level, and it can only do that for a literal. */
export const TODO_SELECT =
  'id, user_id, parent_id, space_id, title, description, due_date, due_time, estimate_minutes, position, is_completed, completed_at, subtask_mode, recurrence, recurrence_parent_id, reminder, source_note_id, created_at, updated_at, space:spaces(id, name, color, icon), attachments:todo_attachments(id, todo_id, kind, file_id, note_id, created_at, file:files(id, filename, mime_type, size_bytes), note:notes(id, title, updated_at))';

/**
 * The same row without its attachments.
 *
 * A PATCH cannot change what is attached to a to-do — that goes through
 * `/api/todos/[id]/attachments` — so the write paths re-read the cheap shape
 * and the client keeps the attachments it already has.
 */
export const TODO_SELECT_LIGHT =
  'id, user_id, parent_id, space_id, title, description, due_date, due_time, estimate_minutes, position, is_completed, completed_at, subtask_mode, recurrence, recurrence_parent_id, reminder, source_note_id, created_at, updated_at, space:spaces(id, name, color, icon)';

const EMPTY_COUNTS: TodoGroups['counts'] = {
  tomorrow: 0,
  restOfWeek: 0,
  total: 0,
  doneThisMonth: 0,
};

export interface LoadOptions {
  filter: TodoFilter;
  spaceId?: string | null;
  /**
   * An explicit window, overriding the filter's own.
   *
   * This is what scrolling into an adjacent week or month asks for: the Week
   * and Month views are open-ended in both directions, so the client widens the
   * range as the user scrolls rather than jumping to a different filter. When
   * absent the filter decides, exactly as before.
   */
  range?: { start: string; end: string } | null;
  /** Skip the count query — a range extension only needs its rows. */
  withCounts?: boolean;
  /**
   * The caller's local date (yyyy-MM-dd).
   *
   * Vercel runs in UTC; users in UTC+7 experience a 7-hour window where the
   * server's "today" is yesterday from their perspective. When the browser
   * sends its own date via this param, the query and grouping use it instead
   * of the server clock, so "Today" always shows the caller's day.
   */
  clientToday?: string | null;
}

export async function loadTodoGroups(
  db: SupabaseClient,
  userId: string,
  { filter, spaceId = null, range: explicitRange = null, withCounts = true, clientToday = null }: LoadOptions
): Promise<{ groups: TodoGroups | null; error: string | null }> {
  const today = clientToday ?? todayISO();

  let query = db.from('todos').select(TODO_SELECT).eq('user_id', userId);
  if (spaceId) query = query.eq('space_id', spaceId);

  /*
   * The window is derived from the *caller's* date, not the server's.
   *
   * This is the whole timezone fix and it has to happen here, not just in the
   * grouping below. Vercel runs UTC; a user in UTC+7 spends seven hours a day
   * in a window where the server's `todayISO()` is the previous calendar day.
   * With the range built from the server clock, `filter=today` asked for
   * `due_date BETWEEN <yesterday> AND <yesterday>` — so the caller's actual
   * today never came back from the database at all, and no amount of correct
   * grouping afterwards could put a row on screen that was never fetched.
   * Week and Month hid the bug because they send an explicit range.
   */
  const range = explicitRange ?? filterRange(filter, fromISODate(today));
  if (range) {
    /*
     * Not a plain BETWEEN. The window is "inside the range, OR undated, OR
     * open and already past": overdue is pinned above the groups under every
     * filter, and undated to-dos have their own column. Without the last
     * clause, opening Today on a Monday hides everything that slipped over the
     * weekend — the worst failure this feature could have.
     */
    query = query.or(
      [
        `and(due_date.gte.${range.start},due_date.lte.${range.end})`,
        'due_date.is.null',
        `and(due_date.lt.${today},is_completed.is.false)`,
      ].join(',')
    );
  }

  /*
   * The rows and the headline counts go out together rather than one after the
   * other. They are independent queries against the same connection, and
   * awaiting them in sequence added a whole round trip to every load of the
   * page — which is what made switching filters feel like a page navigation.
   */
  const [rowsResult, counts] = await Promise.all([
    query,
    withCounts ? loadTodoCounts(db, userId, today) : Promise.resolve(EMPTY_COUNTS),
  ]);

  if (rowsResult.error) return { groups: null, error: rowsResult.error.message };

  return { groups: groupTodos((rowsResult.data || []) as unknown as Todo[], counts, today), error: null };
}

/**
 * Partitions a flat result into the shape the list renders.
 *
 * Exported because the client does exactly the same thing to its own state
 * after an optimistic change — one implementation, so a row cannot land in a
 * different group depending on whether the server or the browser placed it.
 */
export function groupTodos(rows: Todo[], counts: TodoGroups['counts'], today: string): TodoGroups {
  // Sub-tasks nest onto their parents and never appear as top-level rows. The
  // result is partitioned rather than the query filtered, because a parent
  // inside the window needs children that may not be.
  const byParent = new Map<string, Todo[]>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    const list = byParent.get(row.parent_id) || [];
    list.push(row);
    byParent.set(row.parent_id, list);
  }

  const parents = rows.filter((row) => !row.parent_id);
  for (const parent of parents) {
    parent.subtasks = sortByPosition(byParent.get(parent.id) || []);
  }

  const groups: TodoGroups = { overdue: [], dated: {}, unassigned: [], done: {}, counts };

  for (const todo of sortByPosition(parents)) {
    if (todo.is_completed) {
      const key = todo.due_date || '';
      (groups.done[key] = groups.done[key] || []).push(todo);
    } else if (!todo.due_date) {
      groups.unassigned.push(todo);
    } else if (todo.due_date < today) {
      groups.overdue.push(todo);
    } else {
      (groups.dated[todo.due_date] = groups.dated[todo.due_date] || []).push(todo);
    }
  }
  return groups;
}

/**
 * The headline numbers.
 *
 * Counted separately from the rows rather than derived from them, because the
 * "Tomorrow 3 · Rest of week 6" pill has to be right while the Today filter is
 * active — and a Today query does not contain tomorrow.
 *
 * One statement, not four. This used to fire four `head: true` counts in
 * parallel; parallel or not, each is its own HTTP request to PostgREST and the
 * route waited for the slowest. Fetching three narrow columns and tallying
 * them here is a single request whose payload is a few bytes per open to-do —
 * cheaper in practice than the round trips it replaces, and it stays cheap
 * because completed rows are excluded unless they were finished this month.
 */
export async function loadTodoCounts(
  db: SupabaseClient,
  userId: string,
  clientToday: string | null = null
): Promise<TodoGroups['counts']> {
  // Same reason as the window above: "tomorrow" and "rest of week" are the
  // caller's, not the server's.
  const today = clientToday ?? todayISO();
  const from = fromISODate(today);
  const week = weekRange(from);
  const month = monthRange(from);

  const { data, error } = await db
    .from('todos')
    .select('due_date, is_completed, completed_at')
    // Sub-tasks are excluded everywhere — they would double-count every figure.
    .is('parent_id', null)
    .eq('user_id', userId)
    .or(`is_completed.is.false,completed_at.gte.${month.start}T00:00:00`);

  if (error || !data) return { tomorrow: 0, restOfWeek: 0, total: 0, doneThisMonth: 0 };

  const tomorrow = nextDayISO(today);
  const counts = { tomorrow: 0, restOfWeek: 0, total: 0, doneThisMonth: 0 };

  for (const row of data as { due_date: string | null; is_completed: boolean; completed_at: string | null }[]) {
    if (row.is_completed) {
      if (row.completed_at && row.completed_at >= `${month.start}T00:00:00`) counts.doneThisMonth++;
      continue;
    }
    counts.total++;
    if (!row.due_date) continue;
    if (row.due_date === tomorrow) counts.tomorrow++;
    else if (row.due_date > tomorrow && row.due_date <= week.end) counts.restOfWeek++;
  }
  return counts;
}

/** Tomorrow's ISO date, by calendar day rather than by adding 24 hours. */
function nextDayISO(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}
