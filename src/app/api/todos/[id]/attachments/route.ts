import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { ownsTodo, ownsNote, ownsFile, isUuid } from '@/lib/ownership';

/** A to-do with dozens of attachments is a note; the cap keeps the row sane. */
const MAX_ATTACHMENTS = 20;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const kind = body.kind;
  if (kind !== 'file' && kind !== 'note') return apiError('kind must be "file" or "note"', 400);

  const db = createServerClient();
  if (!(await ownsTodo(db, userId!, params.id))) return apiError('Not found', 404);

  /*
   * Three separate references, three separate checks.
   *
   * The row that lands carries the caller's own `user_id`, so it passes every
   * row-level filter while pointing at another account's note or R2 object —
   * exactly the class of hole lib/ownership exists for. Attaching is also a
   * read grant: the panel renders the note's title and hands out a presigned
   * URL for the file.
   */
  const insert: Record<string, unknown> = {
    todo_id: params.id,
    user_id: userId!,
    kind,
    file_id: null,
    note_id: null,
  };

  if (kind === 'note') {
    if (!isUuid(body.note_id)) return apiError('Invalid note_id', 400);
    if (!(await ownsNote(db, userId!, body.note_id))) return apiError('Note not found', 404);
    insert.note_id = body.note_id;
  } else {
    if (!isUuid(body.file_id)) return apiError('Invalid file_id', 400);
    if (!(await ownsFile(db, userId!, body.file_id))) return apiError('File not found', 404);
    insert.file_id = body.file_id;
  }

  const { count } = await db
    .from('todo_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('todo_id', params.id)
    .eq('user_id', userId!);
  if ((count || 0) >= MAX_ATTACHMENTS) {
    return apiError(`A to-do can hold ${MAX_ATTACHMENTS} attachments`, 409);
  }

  const { data, error: dbError } = await db
    .from('todo_attachments')
    .insert(insert)
    .select('*, file:files(*), note:notes(id, title, updated_at)')
    .single();

  if (dbError || !data) {
    // 23505 is the partial unique index on (todo_id, note_id) / (todo_id,
    // file_id) — the same thing attached twice, which is a no-op the user
    // should be told about rather than a failure.
    if (dbError?.code === '23505') return apiError('That is already attached', 409);
    console.error('[todos:attachments:POST]', dbError?.code, dbError?.message);
    return apiError('Could not attach that', 500);
  }
  return NextResponse.json(data, { status: 201 });
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  const db = createServerClient();
  const { data, error: dbError } = await db
    .from('todo_attachments')
    .select('*, file:files(*), note:notes(id, title, updated_at)')
    .eq('todo_id', params.id)
    .eq('user_id', userId!)
    .order('created_at', { ascending: true });

  if (dbError) return apiError('Could not load attachments', 500);
  return NextResponse.json(data || []);
}
