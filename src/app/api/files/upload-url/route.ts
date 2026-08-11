import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { getR2PresignedPutUrl } from '@/lib/r2';
import { v4 as uuidv4 } from 'uuid';

/**
 * Reduces a client-supplied filename to something safe to concatenate into an
 * object key.
 *
 * The key is `${userId}/${uuid}/${filename}`, and the per-user prefix is what
 * /api/files relies on to prove an object belongs to the caller. A filename of
 * `../../someone-else/x` would have walked straight out of that prefix, so the
 * path separators and traversal segments have to go before the key is built.
 */
function safeFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    // Strip control characters, then anything outside a conservative set.
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    // A leading dot would make the object hidden-by-convention and lets
    // "..", "." through as whole segments.
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 180);
  return cleaned || 'file';
}

/**
 * Content types the uploader may claim.
 *
 * R2 echoes the stored Content-Type back on download, so letting a caller
 * store `text/html` or `image/svg+xml` turns the bucket into a host for
 * attacker-chosen markup. Downloads are also forced to `attachment`
 * (see /api/files/[id]) — this is the second half of the same defence.
 */
function safeContentType(raw: string | null): string {
  if (!raw) return 'application/octet-stream';
  if (!/^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i.test(raw)) {
    return 'application/octet-stream';
  }
  const lower = raw.toLowerCase();
  const risky =
    lower.startsWith('text/html') ||
    lower.startsWith('application/xhtml') ||
    lower.startsWith('image/svg') ||
    lower.startsWith('application/xml') ||
    lower.startsWith('text/xml');
  return risky ? 'application/octet-stream' : raw;
}

export async function GET(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const url = new URL(req.url);
  const filename = url.searchParams.get('filename');
  if (!filename) return apiError('filename required', 400);

  const key = `${userId}/${uuidv4()}/${safeFilename(filename)}`;
  const presignedUrl = await getR2PresignedPutUrl(key, safeContentType(url.searchParams.get('contentType')));

  return NextResponse.json({ url: presignedUrl, key });
}
