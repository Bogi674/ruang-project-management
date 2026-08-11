import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.CLOUDFLARE_R2_BUCKET_NAME!;

export async function getR2PresignedPutUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(r2, command, { expiresIn: 900 });
}

/**
 * Types that may render in the browser tab.
 *
 * Deliberately narrow, and deliberately excludes `image/svg+xml`: an SVG is a
 * document that can carry script, so opening one from the bucket origin would
 * execute attacker-chosen markup. Everything outside this list is forced to
 * download instead.
 */
const INLINE_SAFE = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'text/plain',
]);

/** `attachment; filename="…"` with an RFC 5987 fallback for non-ASCII names. */
function contentDisposition(mode: 'inline' | 'attachment', filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Signs a read URL for an object.
 *
 * When `filename`/`mimeType` are supplied the response headers are overridden
 * rather than inherited from the stored object, so a file whose stored
 * Content-Type is `text/html` cannot be opened as a live page on the R2
 * origin. Images, PDFs and plain text still preview in a tab; everything else
 * downloads.
 */
export async function getR2SignedUrl(
  key: string,
  opts?: { filename?: string; mimeType?: string | null }
): Promise<string> {
  const filename = opts?.filename;
  const mime = (opts?.mimeType || '').split(';')[0].trim().toLowerCase();

  let overrides = {};
  if (filename) {
    const inline = INLINE_SAFE.has(mime);
    overrides = {
      ResponseContentType: inline ? mime : 'application/octet-stream',
      ResponseContentDisposition: contentDisposition(inline ? 'inline' : 'attachment', filename),
    };
  }

  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key, ...overrides });
  return getSignedUrl(r2, command, { expiresIn: 3600 });
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
