import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@/lib/supabase';
import { rateLimit } from '@/lib/ratelimit';
import { sendOtpEmail } from '@/lib/resend';
import { currentWindow, deriveCode } from '@/lib/otp';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function hasResend(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Anon-key client used only for resetPasswordForEmail — the one call that must
 * go through Supabase's own email delivery rather than the service role.
 */
function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

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
   * Always return the same response shape whether or not the address is known
   * — a different response would turn this into an account-existence oracle.
   *
   * mode tells the client which UI step comes next:
   *   'otp'  — Resend is configured; user should enter the 6-char code
   *   'link' — Supabase sent a magic link; user should check their email
   */
  const mode = hasResend() ? 'otp' : 'link';

  if (mode === 'otp') {
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
      }
    }
  } else {
    /*
     * No Resend — use Supabase's native password-recovery email. Supabase
     * sends this from its own infrastructure; no custom domain needed.
     * resetPasswordForEmail is a no-op for unknown addresses, so there is
     * no oracle risk from calling it unconditionally.
     */
    const origin = process.env.NEXTAUTH_URL || req.nextUrl.origin;
    try {
      await anonClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password`,
      });
    } catch (err) {
      console.error('[forgot-password] resetPasswordForEmail', (err as Error)?.message);
    }
  }

  return NextResponse.json({ ok: true, mode });
}
