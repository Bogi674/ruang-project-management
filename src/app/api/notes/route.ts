import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const url = new URL(req.url);
  const storeroom = url.searchParams.get('storeroom') === 'true';
  const countOnly = url.searchParams.get('count') === 'true';
  const spaceId = url.searchParams.get('space_id');

  let query = db.from('notes').select('*, space:spaces(*)').eq('user_id', userId!);

  if (storeroom) query = query.is('space_id', null);
  else if (spaceId) query = query.eq('space_id', spaceId);

  if (countOnly) {
    const { count } = await db.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', userId!).is('space_id', null);
    return NextResponse.json({ count: count || 0 });
  }

  query = query.order('updated_at', { ascending: false }).limit(50);
  const { data, error: dbError } = await query;
  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const db = createServerClient();
  const { data, error: dbError } = await db
    .from('notes')
    .insert({ user_id: userId!, type: body.type || 'note', space_id: body.space_id || null, tags: [] })
    .select()
    .single();

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data, { status: 201 });
}
