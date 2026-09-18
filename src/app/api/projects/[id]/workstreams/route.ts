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

  // Verify project ownership
  const { data: project } = await db.from('projects').select('id').eq('id', id).eq('user_id', userId!).single();
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error: dbError } = await db
    .from('workstreams')
    .select('*')
    .eq('project_id', id)
    .eq('user_id', userId!)
    .order('position', { ascending: true });

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

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return apiError('name is required', 400);

  const db = createServerClient();

  // Verify project ownership
  const { data: project } = await db.from('projects').select('id').eq('id', id).eq('user_id', userId!).single();
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error: dbError } = await db
    .from('workstreams')
    .insert({
      project_id: id,
      user_id: userId,
      name,
      color: typeof body.color === 'string' ? body.color : '#A1B5D8',
      position: typeof body.position === 'number' ? body.position : 0,
    })
    .select()
    .single();

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data, { status: 201 });
}
