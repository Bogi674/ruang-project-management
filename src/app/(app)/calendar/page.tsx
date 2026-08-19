import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { loadTodoGroups } from '@/lib/todoQuery';
import { redirect } from 'next/navigation';
import { CalendarScreen } from './CalendarScreen';
import { Note, Widget } from '@/types';

export const dynamic = 'force-dynamic';

interface SearchParams { month?: string; year?: string; day?: string }

/**
 * `/calendar` — the calendar.
 *
 * Singular, deliberately. There used to be a second one behind a List/Calendar
 * switch on `/todo`: a separate month grid, a separate set of drop rules, and
 * a separate answer to "what belongs on a day". Two calendars in one app is a
 * question the user should never have to hold in their head, so the to-dos
 * moved here instead — dated notes, reminders and to-dos on one grid, one
 * unscheduled tray, one place to drag something onto a day.
 */
export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id?: string }).id!;

  const now = new Date();
  const year = parseInt(searchParams.year || String(now.getFullYear()));
  const month = parseInt(searchParams.month || String(now.getMonth() + 1));
  const day = parseInt(searchParams.day || String(now.getDate()));

  const db = createServerClient();

  const [notesResult, widgetsResult, todoResult] = await Promise.all([
    // The calendar renders titles only, so the full TipTap document is left
    // out — it was the single largest payload on this route and grew with
    // every note the user owns.
    db
      .from('notes')
      .select('id, title, type, pinned_date, space_id, updated_at, space:spaces(id, name, color)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),
    db
      .from('widgets')
      .select('id, note_id, type, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    // `all`, because the grid can be navigated to any month — a window scoped
    // to this one would leave last month's cells empty until a refetch.
    loadTodoGroups(db, userId, { filter: 'all' }),
  ]);

  const allNotes = (notesResult.data || []) as unknown as Note[];
  const scheduledNotes = allNotes.filter(n => n.pinned_date);
  const unscheduledNotes = allNotes.filter(n => !n.pinned_date);
  const widgets = (widgetsResult.data || []) as unknown as Widget[];

  return (
    <CalendarScreen
      year={year}
      month={month}
      day={day}
      scheduledNotes={scheduledNotes}
      unscheduledNotes={unscheduledNotes}
      widgets={widgets}
      todoGroups={todoResult.groups}
    />
  );
}
