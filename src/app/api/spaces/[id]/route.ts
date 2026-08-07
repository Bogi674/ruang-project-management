import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const { data, error: dbError } = await db.from('spaces').select('*').eq('id', params.id).eq('owner_id', userId!).single();
  if (dbError || !data) return apiError('Not found', 404);
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const db = createServerClient();
  const updates: Record<string, unknown> = {};
  if ('name' in body) updates.name = body.name;
  if ('color' in body) updates.color = body.color;
  if ('icon' in body) updates.icon = body.icon;

  const { data, error: dbError } = await db.from('spaces').update(updates).eq('id', params.id).eq('owner_id', userId!).select().single();
  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

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
