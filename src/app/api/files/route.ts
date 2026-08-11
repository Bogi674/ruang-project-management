import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { ownsWidget, isUuid } from '@/lib/ownership';

const MAX_FILENAME = 255;
const MAX_SIZE_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }

  const { widget_id, filename, r2_object_key, mime_type, size_bytes } = body as {
    widget_id?: unknown;
    filename?: unknown;
    r2_object_key?: unknown;
    mime_type?: unknown;
    size_bytes?: unknown;
  };

  if (!isUuid(widget_id)) return apiError('Invalid widget_id', 400);
  if (typeof filename !== 'string' || !filename.trim() || filename.length > MAX_FILENAME) {
    return apiError('Invalid filename', 400);
  }

  /*
   * r2_object_key decides which object a later GET hands back a signed URL
   * for, and /api/files/[id] only checks that the *row* belongs to the caller
   * — not that the key does. An unconstrained key was therefore a way to mint
   * a read URL for an arbitrary object in the bucket by pointing your own file
   * row at it. Keys are issued by /api/files/upload-url under a per-user
   * prefix, so requiring that prefix here closes the gap.
   */
  if (typeof r2_object_key !== 'string' || !r2_object_key.startsWith(`${userId}/`)) {
    return apiError('Invalid object key', 400);
  }
  if (r2_object_key.includes('..')) return apiError('Invalid object key', 400);

  const db = createServerClient();

  // A file row inherits its visibility from the widget it hangs off, so the
  // widget has to be the caller's.
  if (!(await ownsWidget(db, userId!, widget_id))) return apiError('Widget not found', 404);

  const size = typeof size_bytes === 'number' && size_bytes >= 0 ? Math.floor(size_bytes) : 0;
  if (size > MAX_SIZE_BYTES) return apiError('File is too large', 400);

  const { data, error: dbError } = await db
    .from('files')
    .insert({
      widget_id,
      uploaded_by: userId!,
      filename,
      r2_object_key,
      r2_bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME!,
      mime_type: typeof mime_type === 'string' && mime_type ? mime_type : 'application/octet-stream',
      size_bytes: size,
    })
    .select()
    .single();

  if (dbError) {
    console.error('[files:POST]', dbError.message);
    return apiError('Could not save file metadata', 500);
  }
  return NextResponse.json(data, { status: 201 });
}
