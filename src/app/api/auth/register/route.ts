import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
  }

  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
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
    .single();

  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, avatar_url: null },
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message || 'Registration failed.' }, { status: 500 });
  }

  return NextResponse.json({ id: data.user.id }, { status: 201 });
}
