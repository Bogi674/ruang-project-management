import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { getR2SignedUrl, deleteFromR2 } from '@/lib/r2';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const { data: file, error: dbError } = await db
    .from('files')
    .select('*')
    .eq('id', params.id)
    .eq('uploaded_by', userId!)
    .single();

  if (dbError || !file) return apiError('Not found', 404);

  const signedUrl = await getR2SignedUrl(file.r2_object_key);
  return NextResponse.json({ url: signedUrl, file });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const { data: file } = await db.from('files').select('r2_object_key').eq('id', params.id).eq('uploaded_by', userId!).single();
  if (!file) return apiError('Not found', 404);

  await deleteFromR2(file.r2_object_key);
  await db.from('files').delete().eq('id', params.id);
  return new NextResponse(null, { status: 204 });
}
