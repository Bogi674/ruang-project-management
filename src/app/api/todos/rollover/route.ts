import { NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { resolveTodoPreferences, todayISO } from '@/lib/todos';

/**
 * Move yesterday's unfinished work onto today.
 *
 * There is no cron in this app (reminder delivery is still manually triggered
 * — see CLAUDE.md), so this is a first-load check: the To-do page calls it once
 * per day and the server decides whether anything should move. Making it a
 * route rather than client-side logic keeps the rule in one place and means a
 * real scheduled job can call the same endpoint later with nothing else to
 * change.
 *
 * It is idempotent by construction: the second call the same day finds nothing
 * with a past `due_date` and updates zero rows.
 */
export async function POST() {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();

  // The setting lives on the user row, and it is the server's job to check it
  // — the client asking to roll over does not make it the user's choice.
  const { data: user } = await db
    .from('users')
    .select('todo_rollover')
    .eq('id', userId!)
    .maybeSingle();

  const prefs = resolveTodoPreferences(user as Record<string, unknown> | null);
  if (!prefs.rollover) return NextResponse.json({ moved: 0, skipped: 'setting off' });

  const today = todayISO();

  /*
   * Only parents move. A sub-task inherits its parent's day, so moving one on
   * its own would strand it in a group the parent is not in.
   *
   * Positions are deliberately left alone: they are scoped to (user, due_date)
   * and yesterday's ordering is the order the user chose, so carrying it over
   * is what "preserving order" means here. Yesterday's rows interleave with
   * today's rather than being pinned above them, which is the intent — this is
   * one day's work, not two lists stacked.
   */
  const { data, error: dbError } = await db
    .from('todos')
    .update({ due_date: today })
    .eq('user_id', userId!)
    .eq('is_completed', false)
    .is('parent_id', null)
    .lt('due_date', today)
    .select('id');

  if (dbError) {
    console.error('[todos:rollover]', dbError.code, dbError.message);
    return apiError('Could not roll your to-dos over', 500);
  }

  // Sub-tasks follow their parents, so their dates are brought back in line.
  const movedIds = (data || []).map((row) => row.id as string);
  if (movedIds.length > 0) {
    await db
      .from('todos')
      .update({ due_date: today })
      .eq('user_id', userId!)
      .in('parent_id', movedIds);
  }

  return NextResponse.json({ moved: movedIds.length });
}
