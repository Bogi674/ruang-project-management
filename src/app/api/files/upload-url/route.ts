import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { getR2PresignedPutUrl } from '@/lib/r2';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const url = new URL(req.url);
  const filename = url.searchParams.get('filename');
  const contentType = url.searchParams.get('contentType') || 'application/octet-stream';

  if (!filename) return apiError('filename required', 400);

  const key = `${userId}/${uuidv4()}/${filename}`;
  const presignedUrl = await getR2PresignedPutUrl(key, contentType);

  return NextResponse.json({ url: presignedUrl, key });
}
