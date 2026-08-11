import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { isUuid } from '@/lib/ownership';

const MAX_CONTENT_BYTES = 256 * 1024;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  if (typeof body.content !== 'object' || body.content === null) {
    return apiError('content must be an object', 400);
  }
  if (JSON.stringify(body.content).length > MAX_CONTENT_BYTES) {
    return apiError('Widget content is too large', 413);
  }

  const db = createServerClient();
  const { data, error: dbError } = await db
    .from('widgets')
    .update({ content: body.content })
    .eq('id', params.id)
    .eq('user_id', userId!)
    .select()
    .single();

  if (dbError) {
    console.error('[widgets:PATCH]', dbError.message);
    return apiError('Could not update widget', 500);
  }
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  const db = createServerClient();
  const { error: dbError } = await db.from('widgets').delete().eq('id', params.id).eq('user_id', userId!);
  if (dbError) {
    console.error('[widgets:DELETE]', dbError.message);
    return apiError('Could not delete widget', 500);
  }
  return new NextResponse(null, { status: 204 });
}
