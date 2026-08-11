import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { isUuid } from '@/lib/ownership';
import { HEX_COLOR } from '@/lib/theme';

export async function GET() {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const [{ data, error: dbError }, { data: noteSpaces }] = await Promise.all([
    db.from('spaces').select('*').eq('owner_id', userId!).order('name', { ascending: true }),
    // Only the foreign key is read — enough to count per space, and far
    // cheaper than pulling note bodies just to know whether a space is empty.
    db.from('notes').select('space_id').eq('user_id', userId!).not('space_id', 'is', null),
  ]);

  if (dbError) return apiError(dbError.message);

  const counts = new Map<string, number>();
  for (const row of noteSpaces || []) {
    const id = (row as { space_id: string | null }).space_id;
    if (id) counts.set(id, (counts.get(id) || 0) + 1);
  }

  const flat = (data || []).map((s) => ({ ...s, note_count: counts.get(s.id) || 0 }));
  const map = new Map(flat.map((s) => [s.id, { ...s, children: [] as typeof flat }]));
  const roots: typeof flat = [];
  for (const space of flat) {
    if (space.parent_id && map.has(space.parent_id)) {
      map.get(space.parent_id)!.children.push(map.get(space.id)!);
    } else {
      roots.push(map.get(space.id)!);
    }
  }
  return NextResponse.json(roots);
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
  if (!name) return apiError('Name required', 400);
  if (name.length > 80) return apiError('Name is too long', 400);
  if (body.color !== undefined && body.color !== null && !HEX_COLOR.test(String(body.color))) {
    return apiError('Invalid colour', 400);
  }

  const db = createServerClient();

  let depth = 0;
  let path = name.toLowerCase().replace(/\s+/g, '-');

  if (body.parent_id) {
    if (!isUuid(body.parent_id)) return apiError('Invalid parent_id', 400);
    /*
     * Scoped to owner_id. Without it any parent id resolved, so a caller could
     * nest a space under someone else's — and the materialised `path` returned
     * in the response spells out that stranger's space names.
     */
    const { data: parent } = await db
      .from('spaces')
      .select('depth, path')
      .eq('id', body.parent_id)
      .eq('owner_id', userId!)
      .maybeSingle();
    if (!parent) return apiError('Parent not found', 404);
    if (parent.depth >= 2) return apiError('Maximum space depth reached', 400);
    depth = parent.depth + 1;
    path = `${parent.path}/${path}`;
  }

  const { data, error: dbError } = await db
    .from('spaces')
    .insert({ name, color: (body.color as string) || '#738290', icon: body.icon || null, owner_id: userId!, parent_id: body.parent_id || null, path, depth })
    .select()
    .single();

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data, { status: 201 });
}
