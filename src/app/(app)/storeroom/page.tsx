import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { NoteList } from '@/components/notes/NoteList';
import { Note } from '@/types';

export const dynamic = 'force-dynamic';

interface SearchParams { type?: string }

export default async function StoreroomPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id?: string }).id!;

  const db = createServerClient();
  let query = db.from('notes').select('*, space:spaces(*)').eq('user_id', userId).is('space_id', null).order('updated_at', { ascending: false });

  if (searchParams.type === 'checklist') query = query.eq('type', 'checklist');
  else if (searchParams.type === 'note') query = query.eq('type', 'note');

  const { data: notes } = await query;
  const items: Note[] = notes || [];

  return (
    <div className="px-4 py-6 md:px-11 md:py-9 max-w-[860px]">
      <div className="mb-6">
        <h1 className="font-serif text-[24px] text-text-primary" style={{ letterSpacing: '-0.02em' }}>
          My Storeroom
        </h1>
        <p className="text-12 text-text-muted mt-1">{items.length} item{items.length !== 1 ? 's' : ''} unassigned</p>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(['all', 'note', 'checklist'] as const).map((f) => {
          const active = (searchParams.type || 'all') === f;
          return (
            <a
              key={f}
              href={f === 'all' ? '/storeroom' : `/storeroom?type=${f}`}
              className={`px-3.5 py-1.5 rounded-full text-13 font-medium no-underline transition-colors duration-120 ${
                active
                  ? 'bg-accent-slate text-white'
                  : 'border border-border-medium text-text-secondary hover:bg-bg-surface'
              }`}
            >
              {f === 'all' ? 'All' : f === 'note' ? 'Notes' : 'Checklists'}
            </a>
          );
        })}
      </div>

      <div className="bg-bg-base border border-border-default rounded-card overflow-hidden">
        <NoteList notes={items} emptyMessage="Nothing here. That's a good sign." spaceId={null} />
      </div>
    </div>
  );
}
