import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { NoteRow } from '@/components/notes/NoteRow';
import { Note } from '@/types';

export const dynamic = 'force-dynamic';

interface SearchParams { q?: string }

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id?: string }).id!;

  const query = searchParams.q?.trim() || '';
  let results: Note[] = [];

  if (query) {
    const db = createServerClient();
    const { data } = await db
      .from('notes')
      .select('*, space:spaces(*)')
      .eq('user_id', userId)
      .or(`title.ilike.%${query}%`)
      .order('updated_at', { ascending: false })
      .limit(30);
    results = data || [];
  }

  return (
    <div className="px-4 py-6 md:px-11 md:py-9 max-w-[720px]">
      <h1 className="font-serif text-[24px] text-text-primary mb-6" style={{ letterSpacing: '-0.02em' }}>Search</h1>

      <form method="get" action="/search" className="mb-6">
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search notes…"
            autoFocus
            className="w-full h-12 pl-11 pr-4 rounded-input border border-border-medium text-14 text-text-primary bg-bg-base outline-none focus:border-accent-blue transition-colors duration-120 placeholder:text-text-muted"
          />
        </div>
      </form>

      {query && (
        <>
          <p className="text-12 text-text-muted mb-3">
            {results.length === 0 ? `Nothing found for "${query}".` : `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`}
          </p>
          {results.length > 0 && (
            <div className="bg-bg-base border border-border-default rounded-card overflow-hidden">
              {results.map((note) => <NoteRow key={note.id} note={note} />)}
            </div>
          )}
        </>
      )}

      {!query && (
        <div>
          <p className="text-[9.5px] font-mono font-semibold uppercase tracking-[0.1em] text-text-faint mb-3">All Notes</p>
          <AllNotes userId={userId} />
        </div>
      )}
    </div>
  );
}

async function AllNotes({ userId }: { userId: string }) {
  const db = createServerClient();
  const { data } = await db.from('notes').select('*, space:spaces(*)').eq('user_id', userId).order('updated_at', { ascending: false }).limit(20);
  const notes: Note[] = data || [];
  if (notes.length === 0) return <p className="text-13 text-text-faint">No notes yet.</p>;
  return (
    <div className="bg-bg-base border border-border-default rounded-card overflow-hidden">
      {notes.map((n) => <NoteRow key={n.id} note={n} />)}
    </div>
  );
}
