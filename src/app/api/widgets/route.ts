import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const url = new URL(req.url);
  const noteId = url.searchParams.get('note_id');

  let query = db.from('widgets').select('*, file:files(*)').eq('user_id', userId!);
  if (noteId) query = query.eq('note_id', noteId);
  else query = query.is('note_id', null);

  const { data, error: dbError } = await query.order('created_at', { ascending: true });
  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data || []);
}

export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  if (!body.type) return apiError('Type required', 400);

  const db = createServerClient();
  const { data, error: dbError } = await db
    .from('widgets')
    .insert({ user_id: userId!, note_id: body.note_id || null, type: body.type, content: body.content || {} })
    .select()
    .single();

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data, { status: 201 });
}
