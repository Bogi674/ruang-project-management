import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { ownsSpace, isUuid } from '@/lib/ownership';
import { collectTodoFields } from '@/lib/todoPayload';
import { nextOccurrenceFrom } from '@/lib/recurrence';
import { todayISO } from '@/lib/todos';
import { TODO_SELECT, TODO_SELECT_LIGHT } from '@/lib/todoQuery';
import type { Todo } from '@/types';

const SELECT = TODO_SELECT;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  const db = createServerClient();
  const { data, error: dbError } = await db
    .from('todos')
    .select(SELECT)
    .eq('id', params.id)
    .eq('user_id', userId!)
    .single();

  if (dbError || !data) return apiError('Not found', 404);

  const { data: subtasks } = await db
    .from('todos')
    .select('*')
    .eq('parent_id', params.id)
    .eq('user_id', userId!)
    .order('position', { ascending: true });

  return NextResponse.json({ ...data, subtasks: subtasks || [] });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const collected = collectTodoFields(body);
  if (collected.problem !== null) return apiError(collected.problem, 400);
  const updates = collected.updates;

  const db = createServerClient();

  /*
   * The fast path.
   *
   * Renaming a to-do, moving it to another day, setting an estimate — none of
   * those touch the rules below, and they are what the UI fires on nearly
   * every interaction. Sending them as a single UPDATE ... RETURNING takes the
   * request from four statements to one; the `user_id` filter on the UPDATE is
   * what proves ownership, so the SELECT that used to prove it first is not
   * doing any work the write does not already do.
   *
   * The heavy read is skipped too: a PATCH cannot change what is attached to a
   * to-do, so the client keeps the attachments it already has.
   */
  const needsRules = 'is_completed' in body || 'space_id' in body;
  if (!needsRules) {
    if (Object.keys(updates).length === 0) return apiError('Nothing to update', 400);

    const { data, error: fastError } = await db
      .from('todos')
      .update(updates)
      .eq('id', params.id)
      .eq('user_id', userId!)
      .select(TODO_SELECT_LIGHT)
      .maybeSingle();

    if (fastError) {
      console.error('[todos:PATCH]', fastError.code, fastError.message);
      return apiError('Could not save the to-do', 500);
    }
    if (!data) return apiError('Not found', 404);
    return NextResponse.json(data);
  }

  const { data: existing } = await db
    .from('todos')
    .select('id, parent_id, is_completed, subtask_mode, due_date')
    .eq('id', params.id)
    .eq('user_id', userId!)
    .maybeSingle();
  if (!existing) return apiError('Not found', 404);

  if ('space_id' in body) {
    if (body.space_id === null) {
      updates.space_id = null;
    } else {
      if (!isUuid(body.space_id)) return apiError('Invalid space_id', 400);
      if (!(await ownsSpace(db, userId!, body.space_id))) return apiError('Space not found', 404);
      updates.space_id = body.space_id;
    }
  }

  /*
   * Completion is server-owned.
   *
   * `completed_at` is what "done at 08:10" and the streak count read, and the
   * client clock is the one thing on the request that cannot be trusted — a
   * phone an hour fast would post completions into the future and break both.
   * The client sends the intent (`is_completed`), the server stamps the time.
   */
  let completing = false;
  if ('is_completed' in body) {
    const next = !!body.is_completed;
    if (next !== existing.is_completed) {
      updates.is_completed = next;
      updates.completed_at = next ? new Date().toISOString() : null;
      completing = next;
    }
  }

  if (Object.keys(updates).length === 0) return apiError('Nothing to update', 400);

  // A dependent parent's checkbox is gated by its sub-tasks. Enforced here as
  // well as in the UI: the button being disabled is a hint, not a rule.
  if (completing && !existing.parent_id && existing.subtask_mode === 'dependent') {
    const { count } = await db
      .from('todos')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', params.id)
      .eq('user_id', userId!)
      .eq('is_completed', false);
    if (count && count > 0) {
      return apiError('Finish the sub-tasks first — this to-do is set to Dependent', 409);
    }
  }

  const { data, error: dbError } = await db
    .from('todos')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', userId!)
    // Light, for the same reason as the fast path above: a PATCH never
    // changes the attachment list, and re-serialising it on every checkbox
    // was the most expensive part of the response.
    .select(TODO_SELECT_LIGHT)
    .single();

  if (dbError || !data) {
    console.error('[todos:PATCH]', dbError?.code, dbError?.message);
    return apiError('Could not save the to-do', 500);
  }

  /*
   * Ticking the last sub-task of a dependent parent closes the parent, and
   * un-ticking any of them re-opens it. Doing this server-side keeps the two
   * rows consistent even when the request came from somewhere that does not
   * know the rule — the mobile sheet, a second tab, a retry.
   */
  let parent = null;
  if (existing.parent_id && 'is_completed' in updates) {
    parent = await syncDependentParent(db, userId!, existing.parent_id);
  }

  // Completing a repeating to-do is what produces the next one.
  const generated = completing
    ? await generateNextOccurrence(db, userId!, data as unknown as Todo)
    : null;

  return NextResponse.json({
    ...data,
    ...(parent ? { parent } : {}),
    ...(generated ? { next_occurrence: generated } : {}),
  });
}

/**
 * Creates the next instance of a repeating to-do.
 *
 * Generated on completion rather than by a scheduled job: there is no cron in
 * this app yet (reminder delivery is still manual — see CLAUDE.md), and doing
 * it here means the next instance exists the moment the user earns it, with
 * no background infrastructure to get wrong.
 *
 * The trade-off is that a repeat the user never ticks never regenerates, which
 * is the correct behaviour anyway: an unticked daily to-do is already sitting
 * there, and a second copy of it would help nobody.
 */
async function generateNextOccurrence(
  db: ReturnType<typeof createServerClient>,
  userId: string,
  todo: Todo
): Promise<Todo | null> {
  if (!todo.recurrence || todo.parent_id || !todo.due_date) return null;

  const ruleOwner = todo.recurrence_parent_id || todo.id;

  // "After N times" counts instances of the same rule, so the chain has to be
  // measured rather than assumed to be one.
  const { count } = await db
    .from('todos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .or(`id.eq.${ruleOwner},recurrence_parent_id.eq.${ruleOwner}`);

  const ends = todo.recurrence.ends;
  if (ends?.type === 'after' && ends.count && (count || 1) >= ends.count) return null;

  const nextDate = nextOccurrenceFrom(todo.recurrence, todo.due_date, todayISO());
  if (!nextDate) return null;

  // An instance already on that date means this ran twice — a double-tap, or a
  // retry after a timeout. Nothing to do.
  const { data: existing } = await db
    .from('todos')
    .select('id')
    .eq('user_id', userId)
    .eq('due_date', nextDate)
    .or(`id.eq.${ruleOwner},recurrence_parent_id.eq.${ruleOwner}`)
    .maybeSingle();
  if (existing) return null;

  const { data, error } = await db
    .from('todos')
    .insert({
      user_id: userId,
      title: todo.title,
      description: todo.description,
      due_date: nextDate,
      due_time: todo.due_time,
      estimate_minutes: todo.estimate_minutes,
      space_id: todo.space_id,
      position: todo.position,
      subtask_mode: todo.subtask_mode,
      recurrence: todo.recurrence,
      recurrence_parent_id: ruleOwner,
      reminder: todo.reminder,
    })
    .select()
    .single();

  if (error) {
    // A failed follow-up must not fail the completion the user just made —
    // they ticked something and it is done. Logged, not surfaced.
    console.error('[todos:recurrence]', error.code, error.message);
    return null;
  }
  return data as Todo;
}

/** Recomputes a dependent parent's own completion from its sub-tasks. */
async function syncDependentParent(
  db: ReturnType<typeof createServerClient>,
  userId: string,
  parentId: string
) {
  const { data: parent } = await db
    .from('todos')
    .select('id, subtask_mode, is_completed')
    .eq('id', parentId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!parent || parent.subtask_mode !== 'dependent') return null;

  const { count: openCount } = await db
    .from('todos')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', parentId)
    .eq('user_id', userId)
    .eq('is_completed', false);

  const shouldBeComplete = (openCount || 0) === 0;
  if (shouldBeComplete === parent.is_completed) return null;

  const { data } = await db
    .from('todos')
    .update({
      is_completed: shouldBeComplete,
      completed_at: shouldBeComplete ? new Date().toISOString() : null,
    })
    .eq('id', parentId)
    .eq('user_id', userId)
    .select()
    .single();
  return data;
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  const db = createServerClient();
  // Sub-tasks and attachments go with it — both cascade in the schema.
  const { error: dbError } = await db
    .from('todos')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId!);

  if (dbError) {
    console.error('[todos:DELETE]', dbError.message);
    return apiError('Could not delete the to-do', 500);
  }
  return new NextResponse(null, { status: 204 });
}
