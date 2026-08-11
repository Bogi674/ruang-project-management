import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { ownsSpace, isUuid } from '@/lib/ownership';

export async function GET(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const url = new URL(req.url);
  const storeroom = url.searchParams.get('storeroom') === 'true';
  const countOnly = url.searchParams.get('count') === 'true';
  const spaceId = url.searchParams.get('space_id');

  if (spaceId && !isUuid(spaceId)) return apiError('Invalid space_id', 400);

  let query = db.from('notes').select('*, space:spaces(*)').eq('user_id', userId!);

  if (storeroom) query = query.is('space_id', null);
  else if (spaceId) query = query.eq('space_id', spaceId);

  if (countOnly) {
    // Previously this branch always counted storeroom notes, ignoring
    // ?space_id — so a space's badge showed the storeroom total.
    let countQuery = db
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId!);
    if (spaceId && !storeroom) countQuery = countQuery.eq('space_id', spaceId);
    else countQuery = countQuery.is('space_id', null);
    const { count } = await countQuery;
    return NextResponse.json({ count: count || 0 });
  }

  query = query.order('updated_at', { ascending: false }).limit(50);
  const { data, error: dbError } = await query;
  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data || []);
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

  const type = body.type === 'checklist' ? 'checklist' : 'note';
  const db = createServerClient();

  // A new note may be filed into a space straight away, but only one the
  // caller owns — the insert's own user_id filter says nothing about the
  // space reference.
  let spaceId: string | null = null;
  if (body.space_id) {
    if (!isUuid(body.space_id)) return apiError('Invalid space_id', 400);
    if (!(await ownsSpace(db, userId!, body.space_id))) return apiError('Space not found', 404);
    spaceId = body.space_id;
  }

  const { data: note, error: dbError } = await db
    .from('notes')
    .insert({ user_id: userId!, type, space_id: spaceId, tags: [] })
    .select()
    .single();

  if (dbError || !note) {
    console.error('[notes:POST]', dbError?.message);
    return apiError('Could not create note', 500);
  }

  // Widgets are never pre-created here. The editor's config form owns widget
  // creation so a row only exists once it has real content.
  return NextResponse.json(note, { status: 201 });
}
