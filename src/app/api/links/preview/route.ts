import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { rateLimit } from '@/lib/ratelimit';
import dns from 'node:dns/promises';
import net from 'node:net';

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

/** IPv4 literal in any of the forms `new URL()` will normalise. */
function ipv4Octets(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

/**
 * True for hosts that must never be fetched: loopback, link-local (including
 * the cloud metadata address), RFC1918, CGNAT, and their IPv6 equivalents.
 *
 * `new URL()` already normalises the decimal, octal and hex IPv4 spellings
 * (`http://2130706433/` becomes `127.0.0.1`), so testing the normalised
 * hostname covers those without parsing them here.
 */
function isBlockedHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase();

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    return true;
  }

  const v4 = ipv4Octets(host);
  if (v4) {
    const [a, b] = v4;
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 169 && b === 254) return true; // link-local + 169.254.169.254
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
    return false;
  }

  // IPv6 literals arrive bracketed from url.hostname.
  if (host.startsWith('[') || host.includes(':')) {
    const v6 = host.replace(/^\[|\]$/g, '');
    if (v6 === '::1' || v6 === '::') return true;
    if (/^f[cd]/.test(v6)) return true; // unique local
    if (/^fe[89ab]/.test(v6)) return true; // link-local

    // IPv4-mapped. `new URL()` rewrites ::ffff:169.254.169.254 into the hex
    // form ::ffff:a9fe:a9fe, so both spellings have to be decoded back to the
    // embedded v4 address and re-tested.
    const dotted = v6.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
    if (dotted) return isBlockedHost(dotted[1]);
    const hex = v6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hex) {
      const hi = parseInt(hex[1], 16);
      const lo = parseInt(hex[2], 16);
      return isBlockedHost(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
    }
    return false;
  }

  return false;
}

/**
 * Resolves a hostname and rejects it if any address it points at is private.
 *
 * The literal checks above only see what the user typed. A hostname the
 * attacker controls — `metadata.their-domain.com A 169.254.169.254` — passes
 * every one of them, and the fetch then reaches the metadata service anyway.
 * Resolving first closes that.
 *
 * This is not a complete defence against DNS rebinding: between this lookup
 * and the socket the fetch opens, the record can change (a TOCTOU window).
 * Closing that fully means resolving once and connecting to the pinned
 * address with a custom agent, or putting the fetch behind an egress proxy.
 */
async function hostResolvesPublicly(hostname: string): Promise<boolean> {
  // A literal address has nothing to resolve; it was already checked.
  if (net.isIP(hostname.replace(/^\[|\]$/g, ''))) return true;
  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return false;
    return records.every((r) => !isBlockedHost(r.address));
  } catch {
    return false;
  }
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
  if (isBlockedHost(url.hostname)) return null;
  return url;
}

const MAX_REDIRECTS = 4;

/**
 * Fetches a URL while re-validating every hop.
 *
 * Following redirects with `redirect: 'follow'` made the host allowlist
 * decorative: any public URL the attacker controls can answer with
 * `302 Location: http://169.254.169.254/latest/meta-data/`, and fetch would
 * chase it straight into the metadata service. Redirects are handled manually
 * so each Location goes back through parsePublicUrl before it is requested.
 */
async function fetchFollowingSafely(
  start: URL,
  signal: AbortSignal
): Promise<{ res: Response; finalUrl: URL } | null> {
  let current = start;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await hostResolvesPublicly(current.hostname))) return null;

    const res = await fetch(current.toString(), {
      signal,
      redirect: 'manual',
      headers: {
        // Some sites serve a bare shell (or 403) to unknown agents.
        'User-Agent': 'Mozilla/5.0 (compatible; RuangBot/1.0; +https://ruang.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (res.status < 300 || res.status > 399) return { res, finalUrl: current };

    const location = res.headers.get('location');
    await res.body?.cancel().catch(() => {});
    if (!location) return null;

    let next: URL;
    try {
      next = new URL(location, current);
    } catch {
      return null;
    }
    const validated = parsePublicUrl(next.toString());
    if (!validated) return null;
    current = validated;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  // This route makes the server fetch a URL of the caller's choosing, so it
  // doubles as an outbound request amplifier if left unmetered.
  const limited = rateLimit(req, 'link-preview', 30, 60 * 1000);
  if (limited) return limited;

  const raw = new URL(req.url).searchParams.get('url');
  if (!raw) return apiError('url required', 400);

  const target = parsePublicUrl(raw);
  if (!target) return apiError('Enter a valid public http(s) URL', 400);

  const domain = target.hostname.replace(/^www\./, '');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const hop = await fetchFollowingSafely(target, controller.signal);
    if (!hop) {
      return NextResponse.json({ domain, og_title: '', og_description: '', og_image: null });
    }
    const { res, finalUrl } = hop;

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

    /*
     * The og:image URL is stored on the widget and later rendered as an <img
     * src>, so it is resolved against the *final* URL and then run through the
     * same public-host check. A page can otherwise name an internal host here
     * and have every viewer's browser request it.
     */
    let ogImage: string | null = null;
    if (rawImage) {
      try {
        ogImage = parsePublicUrl(new URL(rawImage, finalUrl).toString())?.toString() ?? null;
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
