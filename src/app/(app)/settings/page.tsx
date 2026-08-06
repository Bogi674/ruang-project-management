import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { SettingsClient } from './SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const user = session.user as { name?: string; email?: string; image?: string; id?: string };
  return <SettingsClient name={user.name || ''} email={user.email || ''} image={user.image} />;
}
