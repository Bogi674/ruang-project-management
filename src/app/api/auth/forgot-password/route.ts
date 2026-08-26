import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { rateLimit } from '@/lib/ratelimit';
import { sendOtpEmail } from '@/lib/resend';
import { currentWindow, deriveCode } from '@/lib/otp';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  // Throttle: 3 requests per 15 min per IP.
  const limited = rateLimit(req, 'forgot-password', 3, 15 * 60 * 1000);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !EMAIL.test(email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  /*
   * Always return the same response shape whether or not the address is known —
   * a different response would turn this into an account-existence oracle.
   */
  const db = createServerClient();
  const { data: user } = await db
    .from('users')
    .select('id, name')
    .eq('email', email)
    .maybeSingle();

  if (user) {
    const code = deriveCode(email, currentWindow());
    try {
      await sendOtpEmail({ to: email, name: (user.name as string) || 'there', code });
    } catch (err) {
      console.error('[forgot-password] sendOtpEmail', (err as Error)?.message);
      // Still return success — leaking mail-transport failures is unhelpful.
    }
  }

  return NextResponse.json({ ok: true });
}
