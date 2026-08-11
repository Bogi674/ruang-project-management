import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { rateLimit } from '@/lib/ratelimit';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(req: NextRequest) {
  // Registration creates an auth user and sends nothing to verify it, so an
  // unthrottled endpoint is both a spam vector and a way to enumerate which
  // addresses already have accounts.
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

  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  /*
   * Deliberately identical to the success response.
   *
   * Returning "an account with this email already exists" turned this route
   * into an account-existence oracle: anyone could test an address list
   * against it. The signup page tells the user to check for an existing
   * account and sign in instead, without the server confirming which case
   * they are in.
   */
  if (existing) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    // NOTE: this marks the address confirmed without ever mailing it. See the
    // security review — email verification is the outstanding item here, and
    // it is what makes the Google sign-in path in lib/auth.ts safe.
    email_confirm: true,
    user_metadata: { name, avatar_url: null },
  });

  if (error || !data.user) {
    console.error('[register]', error?.message);
    return NextResponse.json({ error: 'Registration failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
