import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { isUuid } from '@/lib/ownership';
import { validatePosition, validateDueDate } from '@/lib/todoPayload';

/**
 * Persist an order change.
 *
 * The client debounces a burst of drags into one call, so this takes a list.
 * A within-group move sends one entry; a cross-date drag sends the same entry
 * with a new `due_date`, which is the whole reason the two travel together —
 * two round trips would let a reload land between them and show the row on its
 * new day at its old position.
 *
 * A rebalance (see `needsRebalance` in lib/todos) sends the whole group.
 */

/** Enough for a full rebalance of a long day, far short of a payload attack. */
const MAX_ENTRIES = 500;

interface Entry {
  id: string;
  position: number;
  due_date?: string | null;
}

export async function PATCH(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const entries = Array.isArray(body) ? body : (body as { items?: unknown }).items;
  if (!Array.isArray(entries)) return apiError('Expected a list of to-dos to reorder', 400);
  if (entries.length === 0) return apiError('Nothing to reorder', 400);
  if (entries.length > MAX_ENTRIES) return apiError('Too many to-dos in one reorder', 400);

  const clean: Entry[] = [];
  const seen = new Set<string>();
  for (const raw of entries) {
    if (!raw || typeof raw !== 'object') return apiError('Invalid reorder entry', 400);
    const entry = raw as Record<string, unknown>;

    if (!isUuid(entry.id)) return apiError('Invalid to-do id', 400);
    // The same id twice would make the final position depend on statement
    // order, which is not something the caller can reason about.
    if (seen.has(entry.id)) return apiError('The same to-do appears twice', 400);
    seen.add(entry.id);

    const positionProblem = validatePosition(entry.position);
    if (positionProblem) return apiError(positionProblem, 400);

    const next: Entry = { id: entry.id, position: entry.position as number };

    if ('due_date' in entry) {
      const dateProblem = validateDueDate(entry.due_date);
      if (dateProblem) return apiError(dateProblem, 400);
      next.due_date = (entry.due_date as string | null) ?? null;
    }
    clean.push(next);
  }

  const db = createServerClient();

  /*
   * Every UPDATE carries its own `user_id` filter rather than trusting the ids
   * in the body. The service-role client bypasses RLS, so a body naming
   * someone else's to-do would otherwise reorder — and with `due_date`, quietly
   * reschedule — a row in another account.
   *
   * Sent as parallel statements rather than one upsert: an upsert would need
   * the full row and could insert a partial to-do if an id did not exist.
   */
  const results = await Promise.all(
    clean.map((entry) => {
      const updates: Record<string, unknown> = { position: entry.position };
      if ('due_date' in entry) updates.due_date = entry.due_date;
      return db
        .from('todos')
        .update(updates)
        .eq('id', entry.id)
        .eq('user_id', userId!)
        .select('id')
        .maybeSingle();
    })
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error('[todos:reorder]', failed.error.code, failed.error.message);
    return apiError('Could not save the new order', 500);
  }

  // Rows that matched nothing were not the caller's (or no longer exist). The
  // client rolls back to the server order on a mismatch rather than leaving a
  // row where the drag put it.
  const updated = results.filter((r) => r.data).length;
  return NextResponse.json({ updated, requested: clean.length });
}
