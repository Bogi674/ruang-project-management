import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const { data, error: dbError } = await db.from('spaces').select('*').eq('id', params.id).eq('owner_id', userId!).single();
  if (dbError || !data) return apiError('Not found', 404);
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const db = createServerClient();
  const updates: Record<string, unknown> = {};
  if ('name' in body) updates.name = body.name;
  if ('color' in body) updates.color = body.color;
  if ('icon' in body) updates.icon = body.icon;

  const { data, error: dbError } = await db.from('spaces').update(updates).eq('id', params.id).eq('owner_id', userId!).select().single();
  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const { error: dbError } = await db.from('spaces').delete().eq('id', params.id).eq('owner_id', userId!);
  if (dbError) return apiError(dbError.message);
  return new NextResponse(null, { status: 204 });
}
