import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { isUuid } from '@/lib/ownership';
import { HEX_COLOR } from '@/lib/theme';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  const db = createServerClient();
  const { data, error: dbError } = await db.from('spaces').select('*').eq('id', params.id).eq('owner_id', userId!).single();
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
  const updates: Record<string, unknown> = {};

  if ('name' in body) {
    if (typeof body.name !== 'string' || !body.name.trim()) return apiError('Name required', 400);
    updates.name = body.name.trim().slice(0, 80);
  }
  if ('color' in body) {
    // Rendered into inline `background` and `border-color` on space chips, so
    // it has to be a literal hex and nothing else.
    if (typeof body.color !== 'string' || !HEX_COLOR.test(body.color)) {
      return apiError('Invalid colour', 400);
    }
    updates.color = body.color;
  }
  if ('icon' in body) {
    if (body.icon !== null && typeof body.icon !== 'string') return apiError('Invalid icon', 400);
    updates.icon = body.icon ? String(body.icon).slice(0, 8) : null;
  }

  if (Object.keys(updates).length === 0) return apiError('Nothing to update', 400);

  const { data, error: dbError } = await db.from('spaces').update(updates).eq('id', params.id).eq('owner_id', userId!).select().single();
  if (dbError) {
    console.error('[spaces:PATCH]', dbError.message);
    return apiError('Could not update space', 500);
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  const db = createServerClient();
  const spaceId = params.id;

  // Verify ownership
  const { data: space, error: spaceErr } = await db.from('spaces').select('id').eq('id', spaceId).eq('owner_id', userId!).single();
  if (spaceErr || !space) return apiError('Not found', 404);

  const url = new URL(req.url);
  const checkOnly = url.searchParams.get('check') === 'true';

  // Collect all descendant space IDs (this space + children + grandchildren)
  const { data: allSpaces } = await db.from('spaces').select('id, parent_id').eq('owner_id', userId!);
  const spaceTree = allSpaces || [];
  function collectDescendants(id: string): string[] {
    const children = spaceTree.filter(s => s.parent_id === id).map(s => s.id);
    return [id, ...children.flatMap(c => collectDescendants(c))];
  }
  const affectedIds = collectDescendants(spaceId);

  // Count notes in all affected spaces
  const { count: noteCount } = await db
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .in('space_id', affectedIds)
    .eq('user_id', userId!);

  const childCount = affectedIds.length - 1;

  if (checkOnly) {
    return NextResponse.json({ noteCount: noteCount || 0, childCount });
  }

  // Move all notes in affected spaces to Storeroom (space_id = null)
  if ((noteCount || 0) > 0) {
    await db.from('notes').update({ space_id: null }).in('space_id', affectedIds).eq('user_id', userId!);
  }

  // Delete all descendant spaces (children first, then root)
  const toDelete = [...affectedIds].reverse();
  for (const sid of toDelete) {
    await db.from('spaces').delete().eq('id', sid).eq('owner_id', userId!);
  }

  return new NextResponse(null, { status: 204 });
}
