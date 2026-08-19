import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { authOptions } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { loadTodoGroups } from '@/lib/todoQuery';
import type { TodoFilter } from '@/types';
import { TodoClient } from './TodoClient';

export const dynamic = 'force-dynamic';

const FILTERS: TodoFilter[] = ['today', 'week', 'month', 'all'];

/**
 * `/todo`.
 *
 * The first window is server-rendered — the same approach as `home/page.tsx` —
 * so the list is on screen with the page rather than after a round trip. The
 * client provider takes it as its initial state and skips its own first fetch.
 *
 * The filter can arrive in the URL (a link, or the Week switch on the
 * next-days pill). Without one the server renders Today and the client
 * restores the user's stored choice on mount, which is why that restore
 * happens in an effect and not during render: the two must not disagree on the
 * first paint.
 */
export default async function TodoPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const userId = (session.user as { id?: string }).id!;

  const requested = searchParams.filter;
  const filter: TodoFilter = FILTERS.includes(requested as TodoFilter)
    ? (requested as TodoFilter)
    : 'week';

  // A failed load is not a failed page: the client refetches and shows its own
  // error, which is a far better outcome than a 500 on the To-do tab.
  const { groups } = await loadTodoGroups(createServerClient(), userId, { filter });

  return (
    <Suspense fallback={null}>
      <TodoClient
        initialGroups={groups}
        initialFilter={requested ? filter : undefined}
      />
    </Suspense>
  );
}
