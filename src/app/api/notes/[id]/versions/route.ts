import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();

  // Verify note ownership
  const { data: note } = await db.from('notes').select('id').eq('id', params.id).eq('user_id', userId!).single();
  if (!note) return apiError('Not found', 404);

  const { data, error: dbError } = await db
    .from('note_versions')
    .select('*')
    .eq('note_id', params.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const db = createServerClient();

  // Verify ownership
  const { data: note } = await db.from('notes').select('id').eq('id', params.id).eq('user_id', userId!).single();
  if (!note) return apiError('Not found', 404);

  // Insert new version
  const { data: version, error: insertError } = await db
    .from('note_versions')
    .insert({ note_id: params.id, user_id: userId!, content: body.content, title: body.title ?? null })
    .select()
    .single();

  if (insertError) return apiError(insertError.message);

  // Prune to 20 most recent
  const { data: all } = await db
    .from('note_versions')
    .select('id')
    .eq('note_id', params.id)
    .order('created_at', { ascending: false });

  if (all && all.length > 20) {
    const toDelete = all.slice(20).map((v: { id: string }) => v.id);
    await db.from('note_versions').delete().in('id', toDelete);
  }

  return NextResponse.json(version, { status: 201 });
}
