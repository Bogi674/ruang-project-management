import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { getR2SignedUrl, deleteFromR2 } from '@/lib/r2';
import { isUuid } from '@/lib/ownership';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  const db = createServerClient();
  const { data: file, error: dbError } = await db
    .from('files')
    .select('*')
    .eq('id', params.id)
    .eq('uploaded_by', userId!)
    .single();

  if (dbError || !file) return apiError('Not found', 404);

  /*
   * Defence in depth against a stored object being served as active content.
   * /api/files/upload-url already refuses to sign HTML/SVG uploads, but rows
   * predating that check — or any object whose stored Content-Type is
   * otherwise unexpected — must not render in the browser off the R2 origin.
   * The signed URL therefore overrides the response headers.
   */
  const signedUrl = await getR2SignedUrl(file.r2_object_key, {
    filename: file.filename,
    mimeType: file.mime_type,
  });
  return NextResponse.json({ url: signedUrl, file });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;
  if (!isUuid(params.id)) return apiError('Not found', 404);

  const db = createServerClient();
  const { data: file } = await db
    .from('files')
    .select('r2_object_key')
    .eq('id', params.id)
    .eq('uploaded_by', userId!)
    .single();
  if (!file) return apiError('Not found', 404);

  await deleteFromR2(file.r2_object_key);
  // Re-scope the delete: params.id alone would drop any row with that id.
  await db.from('files').delete().eq('id', params.id).eq('uploaded_by', userId!);
  return new NextResponse(null, { status: 204 });
}
