import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { extractTitleFromTipTap } from '@/lib/utils';
import { ownsSpace, isUuid } from '@/lib/ownership';

/** Autosave posts the whole document on every sync, so it needs a ceiling. */
const MAX_CONTENT_BYTES = 2 * 1024 * 1024;
const MAX_TITLE = 400;
const MAX_TAGS = 50;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  const db = createServerClient();
  const { data, error: dbError } = await db
    .from('notes')
    .select('*, space:spaces(*), widgets(*)')
    .eq('id', params.id)
    .eq('user_id', userId!)
    .single();

  if (dbError || !data) return apiError('Not found', 404);
  return NextResponse.json(data);
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

  const db = createServerClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ('content' in body) {
    if (body.content !== null && typeof body.content !== 'object') {
      return apiError('content must be a TipTap document', 400);
    }
    if (JSON.stringify(body.content ?? null).length > MAX_CONTENT_BYTES) {
      return apiError('Note is too large to save', 413);
    }
    updates.content = body.content;
    updates.title = extractTitleFromTipTap(body.content);
  }

  if ('title' in body && body.title !== undefined) {
    if (typeof body.title !== 'string') return apiError('title must be a string', 400);
    updates.title = body.title.slice(0, MAX_TITLE);
  }

  if ('space_id' in body) {
    if (body.space_id === null) {
      updates.space_id = null;
    } else {
      // A note carries the colour and name of whatever space it points at, so
      // an unowned space_id would surface another account's space on this
      // note's chip. The reference has to be the caller's own.
      if (!isUuid(body.space_id)) return apiError('Invalid space_id', 400);
      if (!(await ownsSpace(db, userId!, body.space_id))) return apiError('Space not found', 404);
      updates.space_id = body.space_id;
    }
  }

  if ('is_pinned_to_home' in body) updates.is_pinned_to_home = !!body.is_pinned_to_home;
  if ('is_locked' in body) updates.is_locked = !!body.is_locked;

  if ('pinned_date' in body) {
    if (body.pinned_date !== null && !(typeof body.pinned_date === 'string' && ISO_DATE.test(body.pinned_date))) {
      return apiError('pinned_date must be YYYY-MM-DD or null', 400);
    }
    updates.pinned_date = body.pinned_date || null;
  }

  if ('pinned_date_end' in body) {
    if (body.pinned_date_end !== null && !(typeof body.pinned_date_end === 'string' && ISO_DATE.test(body.pinned_date_end))) {
      return apiError('pinned_date_end must be YYYY-MM-DD or null', 400);
    }
    updates.pinned_date_end = body.pinned_date_end || null;
  }

  if ('tags' in body) {
    if (!Array.isArray(body.tags) || body.tags.some((t) => typeof t !== 'string')) {
      return apiError('tags must be an array of strings', 400);
    }
    updates.tags = body.tags.slice(0, MAX_TAGS).map((t: string) => t.slice(0, 60));
  }

  // `avatar_url` used to be accepted here, copied over from the users route.
  // The notes table has no such column, so the write only ever produced a 500
  // — it is dropped rather than plumbed through.

  const { data, error: dbError } = await db
    .from('notes')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', userId!)
    .select()
    .single();

  if (dbError) {
    console.error('[notes:PATCH]', dbError.message);
    return apiError('Could not save note', 500);
  }
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  const db = createServerClient();
  const { error: dbError } = await db
    .from('notes')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId!);

  if (dbError) {
    console.error('[notes:DELETE]', dbError.message);
    return apiError('Could not delete note', 500);
  }
  return new NextResponse(null, { status: 204 });
}
