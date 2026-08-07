import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return apiError('Both current and new password are required.', 400);
  }

  if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return apiError('New password must be at least 8 characters with letters and numbers.', 400);
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
    return apiError(updateError.message, 500);
  }

  return NextResponse.json({ success: true });
}
