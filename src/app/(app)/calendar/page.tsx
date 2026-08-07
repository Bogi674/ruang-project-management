import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { CalendarView } from './CalendarView';
import { Note } from '@/types';

export const dynamic = 'force-dynamic';

interface SearchParams { month?: string; year?: string; day?: string }

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id?: string }).id!;

  const now = new Date();
  const year = parseInt(searchParams.year || String(now.getFullYear()));
  const month = parseInt(searchParams.month || String(now.getMonth() + 1));
  const day = parseInt(searchParams.day || String(now.getDate()));

  // Fetch ±6 weeks around the anchor date for week/day views
  const anchor = new Date(year, month - 1, day);
  const rangeStart = new Date(anchor);
  rangeStart.setDate(rangeStart.getDate() - 42);
  const rangeEnd = new Date(anchor);
  rangeEnd.setDate(rangeEnd.getDate() + 42);

  const startDate = rangeStart.toISOString().split('T')[0];
  const endDate = rangeEnd.toISOString().split('T')[0];

  const db = createServerClient();
  const { data: notes } = await db
    .from('notes')
    .select('id, title, content, type, pinned_date, space:spaces(id, name, color)')
    .eq('user_id', userId)
    .not('pinned_date', 'is', null)
    .gte('pinned_date', startDate)
    .lte('pinned_date', endDate);

  const { data: unscheduled } = await db
    .from('notes')
    .select('id, title, content, type')
    .eq('user_id', userId)
    .is('pinned_date', null)
    .order('updated_at', { ascending: false })
    .limit(30);

  return (
    <CalendarView
      year={year}
      month={month}
      day={day}
      scheduledNotes={(notes || []) as unknown as Note[]}
      unscheduledNotes={(unscheduled || []) as Note[]}
    />
  );
}
