import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Ownership checks for foreign keys that arrive from the client.
 *
 * Every query in this app runs through the Supabase *service role* client,
 * which bypasses row-level security. The RLS policies in supabase_schema.sql
 * are therefore not a backstop — they never execute. The only thing keeping
 * one account out of another's data is the filter each query carries.
 *
 * A `.eq('user_id', userId)` on the row being written is not enough when the
 * body also supplies a foreign key: inserting a widget with someone else's
 * `note_id`, or a file row pointing at someone else's R2 object, passes that
 * filter while still crossing the tenant boundary. Any route that accepts an
 * id from the client resolves it through one of these helpers first.
 */

/** True when the note exists and belongs to `userId`. */
export async function ownsNote(
  db: SupabaseClient,
  userId: string,
  noteId: string
): Promise<boolean> {
  const { data } = await db
    .from('notes')
    .select('id')
    .eq('id', noteId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

/** True when the space exists and belongs to `userId`. */
export async function ownsSpace(
  db: SupabaseClient,
  userId: string,
  spaceId: string
): Promise<boolean> {
  const { data } = await db
    .from('spaces')
    .select('id')
    .eq('id', spaceId)
    .eq('owner_id', userId)
    .maybeSingle();
  return !!data;
}

/** True when the widget exists and belongs to `userId`. */
export async function ownsWidget(
  db: SupabaseClient,
  userId: string,
  widgetId: string
): Promise<boolean> {
  const { data } = await db
    .from('widgets')
    .select('id')
    .eq('id', widgetId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

/** True when the to-do exists and belongs to `userId`. */
export async function ownsTodo(
  db: SupabaseClient,
  userId: string,
  todoId: string
): Promise<boolean> {
  const { data } = await db
    .from('todos')
    .select('id')
    .eq('id', todoId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

/**
 * True when the file exists and was uploaded by `userId`.
 *
 * Attaching a file to a to-do is the same class of reference as `note_id` on a
 * widget: the row that lands carries the caller's user_id and passes every
 * row-level filter while pointing at somebody else's R2 object.
 */
export async function ownsFile(
  db: SupabaseClient,
  userId: string,
  fileId: string
): Promise<boolean> {
  const { data } = await db
    .from('files')
    .select('id')
    .eq('id', fileId)
    .eq('uploaded_by', userId)
    .maybeSingle();
  return !!data;
}

/** Postgres rejects a malformed uuid with a 500; check the shape first. */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
