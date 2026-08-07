import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { NoteCard } from '@/components/notes/NoteCard';
import { Note } from '@/types';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function RoomPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id?: string }).id!;

  const db = createServerClient();
  const today = new Date().toISOString().split('T')[0];

  const [pinnedRes, widgetsRes] = await Promise.all([
    db.from('notes').select('*, space:spaces(*)').eq('user_id', userId).eq('is_pinned_to_home', true).order('updated_at', { ascending: false }).limit(6),
    db.from('widgets').select('*, note:notes(title, id)').eq('user_id', userId).eq('type', 'reminder').gte('content->>date', today).order('content->>date', { ascending: true }).limit(5),
  ]);

  const pinned: Note[] = pinnedRes.data || [];
  const upcoming = widgetsRes.data || [];

  return (
    <div className="px-4 py-6 md:px-11 md:py-9 max-w-[920px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-[24px] text-text-primary" style={{ letterSpacing: '-0.02em' }}>My Room</h1>
        <button className="flex items-center gap-1.5 text-12 text-text-secondary border border-border-default rounded-btn px-3 py-1.5 hover:bg-bg-surface transition-colors duration-120">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Customize
        </button>
      </div>

      {/* Today's Focus */}
      <div className="mb-6 p-5 bg-bg-base border border-border-default rounded-card">
        <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-3">Today&apos;s Focus</p>
        <p className="font-serif text-[20px] text-text-primary italic" style={{ letterSpacing: '-0.02em' }}>
          &ldquo;What matters most today?&rdquo;
        </p>
        <p className="text-11 text-text-faint mt-2">{formatDate(new Date().toISOString())}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Pinned Notes */}
        <div className="bg-bg-base border border-border-default rounded-card p-5">
          <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-3">Pinned Notes</p>
          {pinned.length === 0 ? (
            <p className="text-13 text-text-faint">No pinned notes yet.</p>
          ) : (
            <div className="space-y-2">
              {pinned.map((note) => <NoteCard key={note.id} note={note} />)}
            </div>
          )}
        </div>

        {/* Coming Up */}
        <div className="bg-bg-base border border-border-default rounded-card p-5">
          <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-3">Coming Up</p>
          {upcoming.length === 0 ? (
            <p className="text-13 text-text-faint">No upcoming reminders.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((w) => {
                const c = w.content as { title?: string; date?: string; time?: string; type_label?: string };
                return (
                  <div key={w.id} className="flex items-center gap-3 p-3 rounded-lg bg-[#fff4ee]">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F08050" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-13 font-medium text-text-primary truncate">{c.title || 'Reminder'}</p>
                      <p className="text-11 text-text-muted">{c.date}{c.time ? ` at ${c.time}` : ''}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
