import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { isUuid } from '@/lib/ownership';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; wsId: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const { id, wsId } = params;
  if (!isUuid(id) || !isUuid(wsId)) return apiError('Invalid id', 400);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const db = createServerClient();

  // Ownership: workstream must belong to this project and user
  const { data: existing } = await db
    .from('workstreams')
    .select('id')
    .eq('id', wsId)
    .eq('project_id', id)
    .eq('user_id', userId!)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') updates.name = body.name.trim();
  if (typeof body.color === 'string') updates.color = body.color;
  if (typeof body.position === 'number') updates.position = body.position;

  const { data, error: dbError } = await db
    .from('workstreams')
    .update(updates)
    .eq('id', wsId)
    .eq('user_id', userId!)
    .select()
    .single();

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; wsId: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const { id, wsId } = params;
  if (!isUuid(id) || !isUuid(wsId)) return apiError('Invalid id', 400);

  const db = createServerClient();

  const { error: dbError } = await db
    .from('workstreams')
    .delete()
    .eq('id', wsId)
    .eq('project_id', id)
    .eq('user_id', userId!);

  if (dbError) return apiError(dbError.message);
  return new NextResponse(null, { status: 204 });
}
