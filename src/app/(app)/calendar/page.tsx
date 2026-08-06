import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { CalendarView } from './CalendarView';
import { Note } from '@/types';

export const dynamic = 'force-dynamic';

interface SearchParams { month?: string; year?: string }

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id?: string }).id!;

  const now = new Date();
  const year = parseInt(searchParams.year || String(now.getFullYear()));
  const month = parseInt(searchParams.month || String(now.getMonth() + 1));

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0];

  const db = createServerClient();
  const { data: notes } = await db
    .from('notes')
    .select('*, space:spaces(*)')
    .eq('user_id', userId)
    .not('pinned_date', 'is', null)
    .gte('pinned_date', startDate)
    .lte('pinned_date', endDate);

  const { data: unscheduled } = await db
    .from('notes')
    .select('*, space:spaces(*)')
    .eq('user_id', userId)
    .is('pinned_date', null)
    .order('updated_at', { ascending: false })
    .limit(20);

  return (
    <CalendarView
      year={year}
      month={month}
      scheduledNotes={(notes || []) as Note[]}
      unscheduledNotes={(unscheduled || []) as Note[]}
    />
  );
}
