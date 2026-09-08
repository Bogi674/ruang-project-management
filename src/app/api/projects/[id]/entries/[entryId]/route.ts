import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { isUuid } from '@/lib/ownership';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; entryId: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const { id, entryId } = params;
  if (!isUuid(id) || !isUuid(entryId)) return apiError('Invalid id', 400);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const db = createServerClient();

  // Ownership check
  const { data: existing } = await db
    .from('project_entries')
    .select('id')
    .eq('id', entryId)
    .eq('project_id', id)
    .eq('user_id', userId!)
    .single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (typeof body.title === 'string') updates.title = body.title.trim();
  if (typeof body.status === 'string') updates.status = body.status;
  if ('workstream_id' in body) updates.workstream_id = body.workstream_id;
  if ('pinned_date' in body) updates.pinned_date = body.pinned_date;
  if ('pinned_date_end' in body) updates.pinned_date_end = body.pinned_date_end;
  if (typeof body.position === 'number') updates.position = body.position;
  if ('content' in body) updates.content = body.content;

  const { data, error: dbError } = await db
    .from('project_entries')
    .update(updates)
    .eq('id', entryId)
    .eq('user_id', userId!)
    .select()
    .single();

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; entryId: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const { id, entryId } = params;
  if (!isUuid(id) || !isUuid(entryId)) return apiError('Invalid id', 400);

  const db = createServerClient();

  const { error: dbError } = await db
    .from('project_entries')
    .delete()
    .eq('id', entryId)
    .eq('project_id', id)
    .eq('user_id', userId!);

  if (dbError) return apiError(dbError.message);
  return new NextResponse(null, { status: 204 });
}
