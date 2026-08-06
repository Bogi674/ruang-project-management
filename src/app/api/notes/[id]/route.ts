import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { extractTitleFromTipTap } from '@/lib/utils';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

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

  const body = await req.json();
  const db = createServerClient();

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('content' in body) {
    updates.content = body.content;
    updates.title = extractTitleFromTipTap(body.content);
  }
  if ('space_id' in body) updates.space_id = body.space_id;
  if ('is_pinned_to_home' in body) updates.is_pinned_to_home = body.is_pinned_to_home;
  if ('pinned_date' in body) updates.pinned_date = body.pinned_date;
  if ('tags' in body) updates.tags = body.tags;

  const { data, error: dbError } = await db
    .from('notes')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', userId!)
    .select()
    .single();

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const { error: dbError } = await db
    .from('notes')
    .delete()
    .eq('id', params.id)
    .eq('user_id', userId!);

  if (dbError) return apiError(dbError.message);
  return new NextResponse(null, { status: 204 });
}
