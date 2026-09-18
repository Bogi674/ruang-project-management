import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { isUuid } from '@/lib/ownership';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const { id } = params;
  if (!isUuid(id)) return apiError('Invalid project id', 400);

  const db = createServerClient();

  // Verify project ownership
  const { data: project } = await db.from('projects').select('id').eq('id', id).eq('user_id', userId!).single();
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const url = new URL(req.url);
  const wsId = url.searchParams.get('workstream_id');

  let query = db
    .from('project_entries')
    .select('*')
    .eq('project_id', id)
    .eq('user_id', userId!)
    .order('position', { ascending: true });

  if (wsId) {
    if (!isUuid(wsId)) return apiError('Invalid workstream_id', 400);
    query = query.eq('workstream_id', wsId);
  }

  const { data, error: dbError } = await query;
  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const type = typeof body.type === 'string' ? body.type : 'task';

  const db = createServerClient();

  // Verify project ownership
  const { data: project } = await db.from('projects').select('id').eq('id', id).eq('user_id', userId!).single();
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If workstream_id provided, verify it belongs to this project
  let workstreamId: string | null = null;
  if (body.workstream_id && typeof body.workstream_id === 'string') {
    if (!isUuid(body.workstream_id)) return apiError('Invalid workstream_id', 400);
    const { data: ws } = await db
      .from('workstreams')
      .select('id')
      .eq('id', body.workstream_id)
      .eq('project_id', id)
      .eq('user_id', userId!)
      .single();
    if (!ws) return apiError('Workstream not found', 404);
    workstreamId = body.workstream_id;
  }

  const { data, error: dbError } = await db
    .from('project_entries')
    .insert({
      project_id: id,
      workstream_id: workstreamId,
      user_id: userId,
      type,
      title,
      status: typeof body.status === 'string' ? body.status : type === 'task' ? 'todo' : null,
      pinned_date: typeof body.pinned_date === 'string' ? body.pinned_date : null,
      pinned_date_end: typeof body.pinned_date_end === 'string' ? body.pinned_date_end : null,
      position: typeof body.position === 'number' ? body.position : 0,
    })
    .select()
    .single();

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data, { status: 201 });
}
