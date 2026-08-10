import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';

export const runtime = 'nodejs';

/** Only fetch what the meta tags need — OG data always lives in <head>. */
const MAX_BYTES = 256 * 1024;
const TIMEOUT_MS = 8000;

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

/** Reads `content` off the first <meta> tag whose name/property matches. */
function readMeta(html: string, keys: string[]): string {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${escaped}["'][^>]*>`, 'i'),
    ];
    for (const pattern of patterns) {
      const tag = html.match(pattern)?.[0];
      if (!tag) continue;
      const content = tag.match(/content\s*=\s*["']([^"']*)["']/i)?.[1];
      if (content) return decodeEntities(content);
    }
  }
  return '';
}

/**
 * Reject anything that is not a public http(s) URL. Without this the route
 * would happily proxy `file://`, `http://localhost`, and cloud metadata
 * endpoints on behalf of any logged-in user (SSRF).
 */
function parsePublicUrl(raw: string): URL | null {
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  // A non-http scheme must be rejected outright — prefixing "https://" onto
  // "file:///etc/passwd" would otherwise smuggle it through as a hostname.
  if (hasScheme && !/^https?:\/\//i.test(raw)) return null;

  let url: URL;
  try {
    url = new URL(hasScheme ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return null;
  }
  return url;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const raw = new URL(req.url).searchParams.get('url');
  if (!raw) return apiError('url required', 400);

  const target = parsePublicUrl(raw);
  if (!target) return apiError('Enter a valid public http(s) URL', 400);

  const domain = target.hostname.replace(/^www\./, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Some sites serve a bare shell (or 403) to unknown agents.
        'User-Agent': 'Mozilla/5.0 (compatible; RuangBot/1.0; +https://ruang.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!res.ok || !res.body) {
      // A dead or blocked URL is still savable — return the domain so the
      // user can fill the title in by hand.
      return NextResponse.json({ domain, og_title: '', og_description: '', og_image: null });
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html')) {
      return NextResponse.json({ domain, og_title: '', og_description: '', og_image: null });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      html += decoder.decode(value, { stream: true });
      if (/<\/head>/i.test(html)) break;
    }
    await reader.cancel().catch(() => {});

    const ogTitle =
      readMeta(html, ['og:title', 'twitter:title']) ||
      decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    const ogDescription = readMeta(html, ['og:description', 'twitter:description', 'description']);
    const rawImage = readMeta(html, ['og:image', 'og:image:url', 'twitter:image']);

    let ogImage: string | null = null;
    if (rawImage) {
      try {
        ogImage = new URL(rawImage, target).toString();
      } catch {
        ogImage = null;
      }
    }

    return NextResponse.json({
      domain,
      og_title: ogTitle.slice(0, 300),
      og_description: ogDescription.slice(0, 600),
      og_image: ogImage,
    });
  } catch {
    return NextResponse.json({ domain, og_title: '', og_description: '', og_image: null });
  } finally {
    clearTimeout(timer);
  }
}
