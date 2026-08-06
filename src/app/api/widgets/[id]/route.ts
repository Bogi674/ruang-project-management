import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const db = createServerClient();
  const { data, error: dbError } = await db
    .from('widgets')
    .update({ content: body.content })
    .eq('id', params.id)
    .eq('user_id', userId!)
    .select()
    .single();

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const { error: dbError } = await db.from('widgets').delete().eq('id', params.id).eq('user_id', userId!);
  if (dbError) return apiError(dbError.message);
  return new NextResponse(null, { status: 204 });
}
