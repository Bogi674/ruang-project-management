import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { isUuid } from '@/lib/ownership';
import { POSITION_STEP, MAX_TITLE_FALLBACK, extractTaskItems } from '@/lib/todoMigration';

/**
 * One-time conversion of the old checklist notes into real to-dos.
 *
 * GET lists what is convertible so the card on /todo can show "You have 9
 * checklist notes" with their item counts. POST converts the selected ones.
 *
 * The note is kept, never deleted: it may hold prose around the checklist, and
 * a migration that quietly destroys the thing it migrated is not one anybody
 * would agree to twice. Each created to-do points back at it through
 * `source_note_id`, which is also what makes the whole thing re-runnable
 * without duplicating rows.
 */

export async function GET() {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const { data: notes, error: dbError } = await db
    .from('notes')
    .select('id, title, content, space_id, updated_at')
    .eq('user_id', userId!)
    .eq('type', 'checklist')
    .order('updated_at', { ascending: false });

  if (dbError) {
    console.error('[todos:migrate:GET]', dbError.message);
    return apiError('Could not read your checklist notes', 500);
  }

  // Notes already converted are reported but not offered again, so re-opening
  // the card after a partial run does not create a second copy of everything.
  const { data: converted } = await db
    .from('todos')
    .select('source_note_id')
    .eq('user_id', userId!)
    .not('source_note_id', 'is', null);
  const done = new Set((converted || []).map((row) => row.source_note_id as string));

  const candidates = (notes || [])
    .map((note) => {
      const items = extractTaskItems(note.content as object | null);
      return {
        id: note.id as string,
        title: (note.title as string | null) || 'Untitled',
        item_count: items.length,
        already_converted: done.has(note.id as string),
      };
    })
    .filter((note) => note.item_count > 0);

  return NextResponse.json({ notes: candidates });
}

/** Converting a hundred notes in one request is not a flow worth supporting. */
const MAX_NOTES_PER_RUN = 25;
/** A single note with thousands of task items would be a runaway insert. */
const MAX_ITEMS_PER_NOTE = 200;

export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const ids = body.note_ids;
  if (!Array.isArray(ids) || ids.length === 0) return apiError('Pick at least one note', 400);
  if (ids.length > MAX_NOTES_PER_RUN) return apiError('Too many notes in one go', 400);
  if (ids.some((id) => !isUuid(id))) return apiError('Invalid note id', 400);

  const db = createServerClient();

  // The `user_id` filter here is what makes the id list safe to take from the
  // body at all — a note belonging to someone else simply does not come back.
  const { data: notes, error: dbError } = await db
    .from('notes')
    .select('id, content, space_id')
    .eq('user_id', userId!)
    .eq('type', 'checklist')
    .in('id', ids as string[]);

  if (dbError) {
    console.error('[todos:migrate:POST]', dbError.message);
    return apiError('Could not read those notes', 500);
  }
  if (!notes || notes.length === 0) return apiError('Nothing to convert', 404);

  const rows: Record<string, unknown>[] = [];
  for (const note of notes) {
    const items = extractTaskItems(note.content as object | null).slice(0, MAX_ITEMS_PER_NOTE);
    items.forEach((item, index) => {
      rows.push({
        user_id: userId!,
        title: item.text.slice(0, MAX_TITLE_FALLBACK),
        // Unassigned, always. Dropping a stranger's checklist onto today would
        // bury the day it landed on under work nobody planned for today.
        due_date: null,
        // The note's own space carries over, so converted items land where the
        // note already lived rather than in an undifferentiated pile.
        space_id: note.space_id,
        // Order is preserved across the whole run, not per note, so the tray
        // reads in the order the notes were listed.
        position: (rows.length + 1) * POSITION_STEP,
        is_completed: item.checked,
        // A checklist item records no completion time, and inventing one would
        // put fictional entries into the streak count.
        completed_at: null,
        source_note_id: note.id,
      });
    });
  }

  if (rows.length === 0) return apiError('Those notes have no checklist items', 400);

  const { data: created, error: insertError } = await db.from('todos').insert(rows).select('id');
  if (insertError) {
    console.error('[todos:migrate:POST]', insertError.code, insertError.message);
    return apiError('Could not convert those notes', 500);
  }

  return NextResponse.json(
    { converted: created?.length || 0, notes: notes.length },
    { status: 201 }
  );
}
