import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();

  // Fetch projects and workstream counts in parallel
  const [projectsResult, wsCountResult] = await Promise.all([
    db.from('projects').select('*').eq('user_id', userId!).order('created_at', { ascending: false }),
    db.from('workstreams').select('project_id').eq('user_id', userId!),
  ]);

  if (projectsResult.error) return apiError(projectsResult.error.message);

  const projects = projectsResult.data || [];
  const wsCounts: Record<string, number> = {};
  for (const ws of wsCountResult.data || []) {
    wsCounts[ws.project_id] = (wsCounts[ws.project_id] || 0) + 1;
  }

  return NextResponse.json(
    projects.map((p) => ({ ...p, workstream_count: wsCounts[p.id] || 0 }))
  );
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

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) return apiError('name is required', 400);

  const db = createServerClient();
  const { data, error: dbError } = await db
    .from('projects')
    .insert({
      user_id: userId,
      name,
      color: typeof body.color === 'string' ? body.color : '#A1B5D8',
      status: typeof body.status === 'string' ? body.status : 'todo',
      description: typeof body.description === 'string' ? body.description : null,
      start_date: typeof body.start_date === 'string' ? body.start_date : null,
      end_date: typeof body.end_date === 'string' ? body.end_date : null,
    })
    .select()
    .single();

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data, { status: 201 });
}
