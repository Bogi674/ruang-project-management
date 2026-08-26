import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createServerClient } from '@/lib/supabase';
import { hit, clientIp } from '@/lib/ratelimit';
import { currentWindow, deriveCode } from '@/lib/otp';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Sign a short-lived reset token the client sends to /api/auth/reset-password. */
function signResetToken(email: string, userId: string): string {
  const secret = process.env.OTP_SECRET || process.env.NEXTAUTH_SECRET!;
  const ts = Date.now();
  const payload = `${email}:${userId}:${ts}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`).toString('base64url');
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code =
    typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';

  if (!email || !EMAIL.test(email) || !code) {
    return NextResponse.json({ error: 'Email and code are required.' }, { status: 400 });
  }

  /*
   * Rate-limit OTP attempts per email + IP: 3 tries, then 30-second cooldown.
   */
  const ip = clientIp(req);
  const attemptKey = `otp-attempt:${email}:${ip}`;
  const { ok, retryAfter } = hit(attemptKey, 3, 30 * 1000);
  if (!ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Wait 30 seconds before trying again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    );
  }

  // Accept codes from the current window and the previous one (up to ~20 min).
  const w = currentWindow();
  const valid = code === deriveCode(email, w) || code === deriveCode(email, w - 1);

  if (!valid) {
    return NextResponse.json({ error: 'Incorrect code. Please try again.' }, { status: 400 });
  }

  // Code is correct — look up the user and issue a reset token.
  const db = createServerClient();
  const { data: user } = await db
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!user) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 });
  }

  const token = signResetToken(email, user.id as string);
  return NextResponse.json({ ok: true, token });
}
