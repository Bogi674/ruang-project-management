import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { isUuid } from '@/lib/ownership';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const { id } = params;
  if (!isUuid(id)) return apiError('Invalid project id', 400);

  const db = createServerClient();

  const [projectResult, wsResult, entriesResult] = await Promise.all([
    db.from('projects').select('*').eq('id', id).eq('user_id', userId!).single(),
    db.from('workstreams').select('*').eq('project_id', id).eq('user_id', userId!).order('position', { ascending: true }),
    db.from('project_entries').select('*').eq('project_id', id).eq('user_id', userId!).order('position', { ascending: true }),
  ]);

  if (projectResult.error || !projectResult.data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    ...projectResult.data,
    workstreams: wsResult.data || [],
    entries: entriesResult.data || [],
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const { id } = params;
  if (!isUuid(id)) return apiError('Invalid project id', 400);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const db = createServerClient();

  // Ownership check
  const { data: existing } = await db.from('projects').select('id').eq('id', id).eq('user_id', userId!).single();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (typeof body.name === 'string') updates.name = body.name.trim();
  if (typeof body.color === 'string') updates.color = body.color;
  if (typeof body.status === 'string') updates.status = body.status;
  if ('description' in body) updates.description = body.description;
  if ('start_date' in body) updates.start_date = body.start_date;
  if ('end_date' in body) updates.end_date = body.end_date;

  const { data, error: dbError } = await db
    .from('projects')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId!)
    .select()
    .single();

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const { id } = params;
  if (!isUuid(id)) return apiError('Invalid project id', 400);

  const db = createServerClient();

  const { error: dbError } = await db.from('projects').delete().eq('id', id).eq('user_id', userId!);
  if (dbError) return apiError(dbError.message);
  return new NextResponse(null, { status: 204 });
}
