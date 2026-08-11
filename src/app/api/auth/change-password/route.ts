import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { rateLimit } from '@/lib/ratelimit';

export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  // The route verifies the current password, so it is a password oracle for
  // anyone who has got hold of a session. Throttle it like a login.
  const limited = rateLimit(req, 'change-password', 5, 15 * 60 * 1000);
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid request.', 400);
  }
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return apiError('Both current and new password are required.', 400);
  }

  if (newPassword.length < 8 || newPassword.length > 200 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return apiError('New password must be at least 8 characters with letters and numbers.', 400);
  }

  if (newPassword === currentPassword) {
    return apiError('New password must be different from the current one.', 400);
  }

  const db = createServerClient();

  const { data: userData } = await db.from('users').select('email').eq('id', userId!).single();
  if (!userData?.email) return apiError('User not found.', 404);

  const { error: signInError } = await db.auth.signInWithPassword({
    email: userData.email,
    password: currentPassword,
  });

  if (signInError) {
    return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
  }

  const { error: updateError } = await db.auth.admin.updateUserById(userId!, {
    password: newPassword,
  });

  if (updateError) {
    console.error('[change-password]', updateError.message);
    return apiError('Could not update password.', 500);
  }

  /*
   * NOTE: sessions are JWTs with no server-side store, so changing the
   * password does not invalidate anything already issued — an attacker holding
   * a stolen session cookie keeps it until the JWT expires. Revoking on
   * password change needs either a token version claim checked in the `jwt`
   * callback, or a database session strategy. Flagged in the security review.
   */
  return NextResponse.json({ success: true });
}
