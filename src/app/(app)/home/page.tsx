import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { NoteCard } from '@/components/notes/NoteCard';
import { NoteRow } from '@/components/notes/NoteRow';
import { Note } from '@/types';
import { formatDate, getDayGreeting } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id?: string }).id!;

  const db = createServerClient();

  const [pinnedRes, recentRes, upcomingRes] = await Promise.all([
    db.from('notes').select('*, space:spaces(*)').eq('user_id', userId).eq('is_pinned_to_home', true).order('updated_at', { ascending: false }).limit(6),
    db.from('notes').select('*, space:spaces(*)').eq('user_id', userId).order('updated_at', { ascending: false }).limit(10),
    db.from('widgets').select('*, note:notes(title, id)').eq('user_id', userId).eq('type', 'reminder').order('created_at', { ascending: false }).limit(5),
  ]);

  const pinned: Note[] = pinnedRes.data || [];
  const recent: Note[] = recentRes.data || [];
  const upcoming = upcomingRes.data || [];
  const userName = session.user.name || 'there';
  const today = formatDate(new Date().toISOString());

  return (
    <div className="px-11 py-9 max-w-[920px]">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="font-serif text-[26px] text-text-primary leading-snug" style={{ letterSpacing: '-0.025em' }}>
          {getDayGreeting()}, {userName.split(' ')[0]}.
        </h1>
        <p className="text-12 text-text-faint mt-1">{today}</p>
      </div>

      {/* Pinned */}
      <section className="mb-8">
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-3">Pinned</p>
        {pinned.length === 0 ? (
          <p className="text-13 text-text-faint">Pin a note to keep it at the top.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pinned.map((note) => <NoteCard key={note.id} note={note} />)}
          </div>
        )}
      </section>

      {/* Recent */}
      <section className="mb-8">
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-3">Recent</p>
        <div className="bg-bg-base border border-border-default rounded-card overflow-hidden">
          {recent.length === 0 ? (
            <p className="text-13 text-text-faint p-4">Your Ruang is ready. Tap + to write something.</p>
          ) : (
            recent.map((note) => <NoteRow key={note.id} note={note} />)
          )}
        </div>
      </section>

      {/* Upcoming Reminders */}
      {upcoming.length > 0 && (
        <section>
          <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-3">Upcoming</p>
          <div className="space-y-2">
            {upcoming.map((w) => {
              const content = w.content as { title?: string; date?: string; time?: string; type_label?: string };
              return (
                <div key={w.id} className="flex items-center gap-3 p-3.5 bg-bg-base border border-border-default rounded-card">
                  <div className="w-9 h-9 rounded-lg bg-bg-elevated flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#738290" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-13 font-medium text-text-primary truncate">{content.title || 'Reminder'}</p>
                    <p className="text-11 text-text-muted">
                      {content.date}{content.time ? ` at ${content.time}` : ''} · {content.type_label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
