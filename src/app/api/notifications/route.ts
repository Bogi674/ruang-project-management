import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { isUuid } from '@/lib/ownership';

export async function GET() {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const { data, error: dbError } = await db
    .from('notifications')
    .select('*')
    .eq('recipient_id', userId!)
    .order('created_at', { ascending: false })
    .limit(20);

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data || []);
}

export async function PATCH(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const db = createServerClient();

  if (body.mark_all_read) {
    await db.from('notifications').update({ is_read: true }).eq('recipient_id', userId!).eq('is_read', false);
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    if (!isUuid(body.id)) return apiError('Invalid id', 400);
    const { data } = await db.from('notifications').update({ is_read: true }).eq('id', body.id).eq('recipient_id', userId!).select().single();
    return NextResponse.json(data);
  }

  return apiError('Invalid request', 400);
}
