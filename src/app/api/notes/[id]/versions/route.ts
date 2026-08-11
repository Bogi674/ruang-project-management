import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { isUuid } from '@/lib/ownership';

/** Matches the ceiling on the note itself. */
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  const db = createServerClient();

  // Verify note ownership
  const { data: note } = await db.from('notes').select('id').eq('id', params.id).eq('user_id', userId!).single();
  if (!note) return apiError('Not found', 404);

  const { data, error: dbError } = await db
    .from('note_versions')
    .select('*')
    .eq('note_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data ?? []);
}

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
  if (JSON.stringify(body.content ?? null).length > MAX_CONTENT_BYTES) {
    return apiError('Version is too large to save', 413);
  }

  const db = createServerClient();

  // Verify ownership
  const { data: note } = await db.from('notes').select('id').eq('id', params.id).eq('user_id', userId!).single();
  if (!note) return apiError('Not found', 404);

  // Insert new version
  const { data: version, error: insertError } = await db
    .from('note_versions')
    .insert({ note_id: params.id, user_id: userId!, content: body.content, title: typeof body.title === 'string' ? body.title.slice(0, 400) : null })
    .select()
    .single();

  if (insertError) return apiError(insertError.message);

  // Prune to 20 most recent
  const { data: all } = await db
    .from('note_versions')
    .select('id')
    .eq('note_id', params.id)
    .order('created_at', { ascending: false });

  if (all && all.length > 20) {
    const toDelete = all.slice(20).map((v: { id: string }) => v.id);
    await db.from('note_versions').delete().in('id', toDelete);
  }

  return NextResponse.json(version, { status: 201 });
}
