import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { NoteList } from '@/components/notes/NoteList';
import { SpaceBackground } from '@/components/spaces/SpaceBackground';
import { Note, Space } from '@/types';

/** Parse a hex color string into rgba() with the given alpha (0–1). */
function hexToRgba(hex: string, alpha: number): string {
  const clean = (hex || '#738290').replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) || 115;
  const g = parseInt(clean.slice(2, 4), 16) || 130;
  const b = parseInt(clean.slice(4, 6), 16) || 144;
  return `rgba(${r},${g},${b},${alpha})`;
}

export const dynamic = 'force-dynamic';

interface SearchParams { type?: string }

export default async function SpacePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id?: string }).id!;

  const db = createServerClient();

  const { data: space } = await db
    .from('spaces')
    .select('*')
    .eq('id', params.id)
    .eq('owner_id', userId)
    .single();

  if (!space) notFound();

  let query = db
    .from('notes')
    .select('*, space:spaces(*)')
    .eq('user_id', userId)
    .eq('space_id', params.id)
    .order('updated_at', { ascending: false });

  if (searchParams.type === 'checklist') query = query.eq('type', 'checklist');
  else if (searchParams.type === 'note') query = query.eq('type', 'note');

  const [{ data: notes }, { data: children }, { data: ancestors }] = await Promise.all([
    query,
    db.from('spaces').select('*').eq('owner_id', userId).eq('parent_id', params.id).order('name'),
    db.from('spaces').select('id, name, parent_id').eq('owner_id', userId),
  ]);

  const items: Note[] = notes || [];
  const subSpaces: Space[] = (children || []) as Space[];

  // Walk up the parent chain to build a breadcrumb.
  const byId = new Map((ancestors || []).map((s) => [s.id, s]));
  const trail: Array<{ id: string; name: string }> = [];
  let cursor = space.parent_id as string | null;
  while (cursor && byId.has(cursor)) {
    const node = byId.get(cursor)!;
    trail.unshift({ id: node.id, name: node.name });
    cursor = node.parent_id;
  }

  const spaceColor = space.color || '#738290';

  return (
    // position: relative scopes the absolutely-positioned background layers.
    // --space-color is injected here so any descendant CSS rule can reference it.
    <div
      // The shell already reserves the navbar, so a full `100vh` here would
      // overshoot the content area by exactly the navbar's height and give the
      // page a strip of empty scroll. --app-content-h is what is actually left.
      className="relative min-h-[var(--app-content-h)]"
      style={{ '--space-color': spaceColor } as React.CSSProperties}
    >
      {/* Procedural SVG background — unique and permanent per space */}
      <SpaceBackground spaceId={space.id} spaceColor={spaceColor} />

      {/* Soft colour wash fading down from the top */}
      <div
        aria-hidden="true"
        className="space-color-wash"
        style={{
          background: `linear-gradient(180deg, ${hexToRgba(spaceColor, 0.13)} 0%, transparent 100%)`,
        }}
      />

      {/* All page content sits above the background layers */}
      <div className="relative z-10 px-4 py-6 md:px-11 md:py-9 max-w-[860px]">
        <div className="mb-6">
          {trail.length > 0 && (
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              {trail.map((t) => (
                <span key={t.id} className="flex items-center gap-1.5">
                  <Link
                    href={`/space/${t.id}`}
                    className="text-[11px] text-text-faint hover:text-text-muted no-underline"
                  >
                    {t.name}
                  </Link>
                  <span className="text-[11px] text-text-faint">›</span>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2.5">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ background: spaceColor }}
            />
            <h1 className="font-serif text-[24px] text-text-primary" style={{ letterSpacing: '-0.02em' }}>
              {space.icon && `${space.icon} `}{space.name}
            </h1>
          </div>
          <p className="text-12 text-text-muted mt-1">
            {items.length} item{items.length !== 1 ? 's' : ''}
            {subSpaces.length > 0 && ` · ${subSpaces.length} sub-space${subSpaces.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Sub-spaces */}
        {subSpaces.length > 0 && (
          <div className="flex gap-2 mb-5 flex-wrap">
            {subSpaces.map((s) => (
              <Link
                key={s.id}
                href={`/space/${s.id}`}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border-default text-13 text-text-secondary no-underline hover:bg-bg-surface transition-colors duration-120"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: s.color || '#738290' }}
                />
                {s.icon && `${s.icon} `}{s.name}
              </Link>
            ))}
          </div>
        )}

        {/* Filter chips — active chip uses the space colour instead of generic slate */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {(['all', 'note', 'checklist'] as const).map((f) => {
            const active = (searchParams.type || 'all') === f;
            return (
              <Link
                key={f}
                href={f === 'all' ? `/space/${params.id}` : `/space/${params.id}?type=${f}`}
                className="px-3.5 py-1.5 rounded-full text-13 font-medium no-underline transition-colors duration-120"
                style={
                  active
                    ? { background: spaceColor, color: '#ffffff' }
                    : { border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }
                }
              >
                {f === 'all' ? 'All' : f === 'note' ? 'Notes' : 'Checklists'}
              </Link>
            );
          })}
        </div>

        <div className="bg-bg-base border border-border-default rounded-card overflow-hidden">
          <NoteList
            notes={items}
            emptyMessage="Nothing in this space yet."
            spaceId={params.id}
          />
        </div>
      </div>
    </div>
  );
}
