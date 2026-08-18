import { addDays } from 'date-fns';
import type { SupabaseClient } from '@supabase/supabase-js';
import { filterRange, monthRange, sortByPosition, toISODate, todayISO, weekRange } from './todos';
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

/** Everything a to-do row needs to render, in one query. */
export const TODO_SELECT =
  '*, space:spaces(*), attachments:todo_attachments(*, file:files(*), note:notes(id, title, updated_at))';

export interface LoadOptions {
  filter: TodoFilter;
  spaceId?: string | null;
}

export async function loadTodoGroups(
  db: SupabaseClient,
  userId: string,
  { filter, spaceId = null }: LoadOptions
): Promise<{ groups: TodoGroups | null; error: string | null }> {
  const today = todayISO();

  let query = db.from('todos').select(TODO_SELECT).eq('user_id', userId);
  if (spaceId) query = query.eq('space_id', spaceId);

  const range = filterRange(filter);
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

  const { data, error } = await query;
  if (error) return { groups: null, error: error.message };

  const rows = (data || []) as unknown as Todo[];

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

  const groups: TodoGroups = {
    overdue: [],
    dated: {},
    unassigned: [],
    done: {},
    counts: { tomorrow: 0, restOfWeek: 0, total: 0, doneThisMonth: 0 },
  };

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

  groups.counts = await loadTodoCounts(db, userId);
  return { groups, error: null };
}

/**
 * The headline numbers.
 *
 * Counted separately rather than derived from `groups`, because the
 * "Tomorrow 3 · Rest of week 6" pill has to be right while the Today filter is
 * active — and a Today query does not contain tomorrow. Head-only: the rows
 * are not wanted, only the totals.
 */
export async function loadTodoCounts(
  db: SupabaseClient,
  userId: string
): Promise<TodoGroups['counts']> {
  const tomorrow = toISODate(addDays(new Date(), 1));
  const week = weekRange();
  const month = monthRange();

  /** Sub-tasks are excluded everywhere — they would double-count every figure. */
  const base = () =>
    db
      .from('todos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('parent_id', null);

  const [tomorrowRes, restOfWeekRes, totalRes, doneRes] = await Promise.all([
    base().eq('due_date', tomorrow).eq('is_completed', false),
    base().gt('due_date', tomorrow).lte('due_date', week.end).eq('is_completed', false),
    base().eq('is_completed', false),
    base().eq('is_completed', true).gte('completed_at', `${month.start}T00:00:00`),
  ]);

  return {
    tomorrow: tomorrowRes.count || 0,
    restOfWeek: restOfWeekRes.count || 0,
    total: totalRes.count || 0,
    doneThisMonth: doneRes.count || 0,
  };
}
