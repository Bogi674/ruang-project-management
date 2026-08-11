import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { ownsNote, isUuid } from '@/lib/ownership';

export async function GET(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const url = new URL(req.url);
  const noteId = url.searchParams.get('note_id');

  let query = db.from('widgets').select('*, file:files(*)').eq('user_id', userId!);
  if (noteId) query = query.eq('note_id', noteId);
  else query = query.is('note_id', null);

  const { data, error: dbError } = await query.order('created_at', { ascending: true });
  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data || []);
}

const WIDGET_TYPES = ['reminder', 'file', 'link'];

export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  if (typeof body.type !== 'string' || !WIDGET_TYPES.includes(body.type)) {
    return apiError('Type must be one of: reminder, file, link', 400);
  }

  const db = createServerClient();

  /*
   * note_id comes from the client, and the row-level `user_id` filter says
   * nothing about it — without this check a widget could be attached to
   * another account's note, where the owner would then see it rendered as
   * their own attachment.
   */
  let noteId: string | null = null;
  if (body.note_id) {
    if (!isUuid(body.note_id)) return apiError('Invalid note_id', 400);
    if (!(await ownsNote(db, userId!, body.note_id))) return apiError('Note not found', 404);
    noteId = body.note_id;
  }

  const { data, error: dbError } = await db
    .from('widgets')
    .insert({
      user_id: userId!,
      note_id: noteId,
      type: body.type,
      content: body.content ?? {},
    })
    .select()
    .single();

  if (dbError) {
    console.error('[widgets:POST]', dbError.message);
    return apiError('Could not create widget', 500);
  }
  return NextResponse.json(data, { status: 201 });
}
