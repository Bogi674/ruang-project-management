import { NextRequest, NextResponse } from 'next/server';

/**
 * Fixed-window rate limiter.
 *
 * IMPORTANT — this is per-instance, in-memory state. On Vercel each serverless
 * instance keeps its own counters, so the effective limit is
 * `limit × instances` and everything resets on a cold start. That is a real
 * weakening, not a detail: it makes this a speed bump against credential
 * stuffing, not a control you can rely on.
 *
 * It is here because the alternative was nothing at all on /api/auth/register,
 * the credentials login and the password change. For a limit you can actually
 * depend on, move the counter to shared storage (Vercel KV / Upstash Redis)
 * and keep the same call sites — only `hit()` needs to change.
 */
interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();
const MAX_KEYS = 10_000;

function sweep(now: number) {
  if (buckets.size < MAX_KEYS) return;

  const expired: string[] = [];
  buckets.forEach((win, key) => {
    if (win.resetAt <= now) expired.push(key);
  });
  expired.forEach((key) => buckets.delete(key));

  // Still full of live windows: drop the oldest rather than grow without
  // bound. Losing a counter fails open, which is the correct trade here — an
  // unbounded map would take the process down instead.
  if (buckets.size >= MAX_KEYS) {
    const live: Array<[string, number]> = [];
    buckets.forEach((win, key) => live.push([key, win.resetAt]));
    live.sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < live.length / 2; i++) buckets.delete(live[i][0]);
  }
}

export function hit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/**
 * Best-effort client address.
 *
 * `x-forwarded-for` is spoofable in general; behind Vercel's proxy the
 * left-most entry is the real client and downstream hops are appended, so it
 * is usable here but must not be treated as an identity anywhere else.
 */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/** Returns a 429 response when the caller is over budget, else null. */
export function rateLimit(
  req: NextRequest,
  scope: string,
  limit: number,
  windowMs: number
): NextResponse | null {
  const { ok, retryAfter } = hit(`${scope}:${clientIp(req)}`, limit, windowMs);
  if (ok) return null;
  return NextResponse.json(
    { error: 'Too many attempts. Please wait and try again.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } }
  );
}
