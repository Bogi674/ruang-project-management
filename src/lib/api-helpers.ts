import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { NextResponse } from 'next/server';

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), userId: null };
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), userId: null };
  }
  return { error: null, userId };
}

export function apiError(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status });
}
