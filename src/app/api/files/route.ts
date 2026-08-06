import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const { widget_id, filename, r2_object_key, mime_type, size_bytes } = body;
  if (!widget_id || !filename || !r2_object_key) return apiError('Missing required fields', 400);

  const db = createServerClient();
  const { data, error: dbError } = await db
    .from('files')
    .insert({
      widget_id,
      uploaded_by: userId!,
      filename,
      r2_object_key,
      r2_bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      mime_type: mime_type || 'application/octet-stream',
      size_bytes: size_bytes || 0,
    })
    .select()
    .single();

  if (dbError) return apiError(dbError.message);
  return NextResponse.json(data, { status: 201 });
}
