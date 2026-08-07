import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SettingsClient } from './SettingsClient';
import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user as { name?: string; email?: string; image?: string; id?: string };

  let dbAvatar: string | null = null;
  const isGoogleUser = (user as { provider?: string }).provider === 'google';
  if (user.id) {
    const db = createServerClient();
    const { data } = await db.from('users').select('avatar_url').eq('id', user.id).single();
    dbAvatar = data?.avatar_url || null;
  }

  return (
    <SettingsClient
      name={user.name || ''}
      email={user.email || ''}
      image={dbAvatar || user.image}
      isGoogleUser={isGoogleUser}
    />
  );
}
