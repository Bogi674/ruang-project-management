import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { rateLimit } from '@/lib/ratelimit';
import { sendVerificationEmail } from '@/lib/resend';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Whether this deployment can prove an address belongs to whoever typed it.
 *
 * With no mail transport there is nothing to send, and refusing to register
 * anyone would be worse than the risk — so the route falls back to the old
 * confirmed-on-creation behaviour and says so in the log. Set RESEND_API_KEY
 * (and EMAIL_FROM to a verified sender) to turn verification on.
 */
function canVerifyEmail(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function POST(req: NextRequest) {
  // An unthrottled registration endpoint is both a spam vector and a way to
  // enumerate which addresses already have accounts.
  const limited = rateLimit(req, 'register', 5, 15 * 60 * 1000);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: 'Name is too long.' }, { status: 400 });
  }
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (password.length < 8 || password.length > 200 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters with letters and numbers.' },
      { status: 400 }
    );
  }

  const db = createServerClient();
  const verify = canVerifyEmail();

  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  /*
   * Deliberately identical to the success response, `verify` included — that
   * flag is decided by server configuration, never by whether this particular
   * address is taken.
   *
   * Returning "an account with this email already exists" turned this route
   * into an account-existence oracle: anyone could test an address list
   * against it. The signup page tells the user to check for an existing
   * account and sign in instead, without the server confirming which case
   * they are in.
   */
  if (existing) {
    return NextResponse.json({ ok: true, verify }, { status: 201 });
  }

  if (!verify) {
    console.warn(
      '[register] RESEND_API_KEY is not set — creating a pre-confirmed account without verifying the address.'
    );
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, avatar_url: null },
    });
    if (error) {
      // "already registered" means a partial earlier signup left the auth user
      // without its public.users counterpart. Return success so the client
      // tries to sign in — the handle_new_user trigger or auth.ts upsert will
      // reconcile the missing row on the next Google sign-in; for email/password
      // the sign-in will succeed if the password matches.
      const alreadyExists =
        error.message?.toLowerCase().includes('already') ||
        error.message?.toLowerCase().includes('duplicate');
      if (!alreadyExists) {
        console.error('[register]', error.message);
        return NextResponse.json({ error: 'Registration failed.' }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true, verify: false }, { status: 201 });
  }

  /*
   * generateLink creates the auth user *unconfirmed* and hands back the
   * confirmation URL without mailing it, which is what lets Ruang send it
   * through its own transport rather than depending on the Supabase project's
   * SMTP settings.
   *
   * Unconfirmed matters beyond the obvious: `signInWithPassword` refuses an
   * unconfirmed account, so registering an address you do not own now buys
   * nothing. That is the hole this closes — Google sign-in in lib/auth.ts
   * adopts an existing row by email address, so a squatter who could log in
   * with their own password was one Google sign-in away from sharing the real
   * owner's workspace.
   */
  const origin = process.env.NEXTAUTH_URL || req.nextUrl.origin;
  const { data, error } = await db.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      data: { name, avatar_url: null },
      redirectTo: `${origin}/login?verified=1`,
    },
  });

  const link = data?.properties?.action_link;
  if (error || !data?.user || !link) {
    // If the address is already registered, return success silently — same
    // anti-enumeration promise as the public.users check above.
    const alreadyExists =
      error?.message?.toLowerCase().includes('already') ||
      error?.message?.toLowerCase().includes('duplicate');
    if (alreadyExists) {
      return NextResponse.json({ ok: true, verify: true }, { status: 201 });
    }
    console.error('[register:generateLink]', error?.message);
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 });
  }

  try {
    await sendVerificationEmail({ to: email, name, link });
  } catch (mailError) {
    /*
     * The account now exists but nothing can reach it — leaving it that way
     * would lock the person out of an address they do own. Confirm it so
     * signup still completes, and make the misconfiguration loud in the log.
     */
    console.error('[register:sendVerificationEmail]', (mailError as Error)?.message);
    await db.auth.admin.updateUserById(data.user.id, { email_confirm: true });
    return NextResponse.json({ ok: true, verify: false }, { status: 201 });
  }

  return NextResponse.json({ ok: true, verify: true }, { status: 201 });
}
