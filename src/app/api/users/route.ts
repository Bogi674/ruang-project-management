import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';

export async function GET() {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const { data, error: dbError } = await db.from('users').select('*').eq('id', userId!).single();
  if (dbError || !data) return apiError('Not found', 404);
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const db = createServerClient();
  const allowed = ['name', 'accent_color', 'typography_preference', 'surface_preference', 'density_preference', 'landing_page_preference', 'theme_preference'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error: dbError } = await db.from('users').update(updates).eq('id', userId!).select().single();
  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data);
}
