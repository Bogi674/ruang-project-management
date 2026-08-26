import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { createServerClient } from '@/lib/supabase';
import { rateLimit } from '@/lib/ratelimit';

const TOKEN_MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

function verifyResetToken(
  token: string
): { email: string; userId: string } | null {
  try {
    const secret = process.env.OTP_SECRET || process.env.NEXTAUTH_SECRET!;
    const decoded = Buffer.from(token, 'base64url').toString();
    const lastPipe = decoded.lastIndexOf('|');
    if (lastPipe === -1) return null;
    const payload = decoded.slice(0, lastPipe);
    const sig = decoded.slice(lastPipe + 1);
    const parts = payload.split(':');
    if (parts.length < 3) return null;
    // email may contain ':', so everything before the last two ':'-delimited
    // parts (userId, ts) is the email.
    const ts = parts[parts.length - 1];
    const userId = parts[parts.length - 2];
    const email = parts.slice(0, parts.length - 2).join(':');
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (sig !== expected) return null;
    if (Date.now() - parseInt(ts, 10) > TOKEN_MAX_AGE_MS) return null;
    return { email, userId };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 'reset-password', 5, 15 * 60 * 1000);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!token) {
    return NextResponse.json({ error: 'Reset token is missing.' }, { status: 400 });
  }
  if (
    password.length < 8 ||
    password.length > 200 ||
    !/[a-zA-Z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters with letters and numbers.' },
      { status: 400 }
    );
  }

  const verified = verifyResetToken(token);
  if (!verified) {
    return NextResponse.json(
      { error: 'This link has expired. Request a new code.' },
      { status: 400 }
    );
  }

  const db = createServerClient();
  const { error } = await db.auth.admin.updateUserById(verified.userId, { password });
  if (error) {
    console.error('[reset-password]', error.message);
    return NextResponse.json({ error: 'Could not update password.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
