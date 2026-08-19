import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { ownsSpace, isUuid } from '@/lib/ownership';
import { collectTodoFields } from '@/lib/todoPayload';
import { loadTodoCounts, loadTodoGroups, TODO_SELECT_LIGHT } from '@/lib/todoQuery';
import { isISODate, POSITION_STEP } from '@/lib/todos';
import type { TodoFilter } from '@/types';

const FILTERS: TodoFilter[] = ['today', 'week', 'month', 'all'];

export async function GET(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const url = new URL(req.url);
  const filterParam = url.searchParams.get('filter') || 'today';
  if (!FILTERS.includes(filterParam as TodoFilter)) return apiError('Unknown filter', 400);

  const spaceId = url.searchParams.get('space');
  if (spaceId && !isUuid(spaceId)) return apiError('Invalid space', 400);

  /*
   * An explicit window. The Week and Month views scroll into adjacent periods
   * rather than being pinned to the one the filter names, and each extension
   * asks for exactly the slice it just revealed — so the rows already on screen
   * are never re-sent, and never replaced.
   */
  const startParam = url.searchParams.get('start');
  const endParam = url.searchParams.get('end');
  let range: { start: string; end: string } | null = null;
  if (startParam || endParam) {
    if (!isISODate(startParam) || !isISODate(endParam)) {
      return apiError('start and end must both be yyyy-MM-dd dates', 400);
    }
    if (endParam < startParam) return apiError('end must not precede start', 400);
    range = { start: startParam, end: endParam };
  }

  // The sidebar badge wants one number, not every row for the window. Skipping
  // the row query keeps a count that refreshes on every navigation cheap.
  if (url.searchParams.get('count') === 'true') {
    return NextResponse.json(await loadTodoCounts(createServerClient(), userId!));
  }

  const { groups, error: loadError } = await loadTodoGroups(createServerClient(), userId!, {
    filter: filterParam as TodoFilter,
    spaceId,
    range,
    // A range extension is merged into what is already loaded, so it has no use
    // for the headline totals — and they are the only part of the response that
    // costs a second statement.
    withCounts: !range,
  });

  if (loadError || !groups) {
    console.error('[todos:GET]', loadError);
    return apiError('Could not load to-dos', 500);
  }
  return NextResponse.json(groups);
}

export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const collected = collectTodoFields(body);
  if (collected.problem !== null) return apiError(collected.problem, 400);
  const insert = collected.updates;

  if (typeof insert.title !== 'string') return apiError('A to-do needs a title', 400);

  const db = createServerClient();

  // A to-do carries its space's name and colour on the row chip, so an unowned
  // space_id would surface another account's space here.
  if (body.space_id) {
    if (!isUuid(body.space_id)) return apiError('Invalid space_id', 400);
    if (!(await ownsSpace(db, userId!, body.space_id))) return apiError('Space not found', 404);
    insert.space_id = body.space_id;
  }

  if (body.parent_id) {
    if (!isUuid(body.parent_id)) return apiError('Invalid parent_id', 400);
    const { data: parent } = await db
      .from('todos')
      .select('id, parent_id, due_date, space_id')
      .eq('id', body.parent_id)
      .eq('user_id', userId!)
      .maybeSingle();
    if (!parent) return apiError('Parent to-do not found', 404);
    // One level only. The database cannot express this (it needs a second
    // row), so the rule is enforced here — see the phase 7 migration comment.
    if (parent.parent_id) return apiError('A sub-task cannot have sub-tasks of its own', 400);
    insert.parent_id = parent.id;
    // Sub-tasks live on their parent's day and in its space unless told
    // otherwise, so they never strand themselves in a different group.
    if (!('due_date' in insert)) insert.due_date = parent.due_date;
    if (!('space_id' in insert)) insert.space_id = parent.space_id;
  }

  // Append to the end of whichever group this lands in, unless the caller
  // already computed a fractional position (a drop, or an inline add between
  // two rows).
  if (!('position' in insert)) {
    insert.position = await nextPosition(
      db,
      userId!,
      (insert.due_date as string | null) ?? null,
      (insert.parent_id as string | undefined) ?? null
    );
  }

  const { data, error: dbError } = await db
    .from('todos')
    .insert({ ...insert, user_id: userId! })
    // A to-do that has just been created has nothing attached to it, so the
    // attachment embed would cost a join to return an empty array.
    .select(TODO_SELECT_LIGHT)
    .single();

  if (dbError || !data) {
    console.error('[todos:POST]', dbError?.code, dbError?.message);
    return apiError('Could not create the to-do', 500);
  }
  return NextResponse.json(data, { status: 201 });
}

/** One step past the last row in the target group. */
async function nextPosition(
  db: ReturnType<typeof createServerClient>,
  userId: string,
  dueDate: string | null,
  parentId: string | null
): Promise<number> {
  let query = db
    .from('todos')
    .select('position')
    .eq('user_id', userId)
    .order('position', { ascending: false })
    .limit(1);

  if (parentId) query = query.eq('parent_id', parentId);
  else if (dueDate) query = query.eq('due_date', dueDate).is('parent_id', null);
  else query = query.is('due_date', null).is('parent_id', null);

  const { data } = await query;
  const last = data?.[0]?.position;
  return typeof last === 'number' ? last + POSITION_STEP : POSITION_STEP;
}
