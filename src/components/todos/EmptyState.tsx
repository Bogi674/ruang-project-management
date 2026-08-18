'use client';

import { addDays } from 'date-fns';
import { toISODate, todayISO } from '@/lib/todos';
import { CheckIcon } from './icons';
import { useTodos } from './TodoProvider';

type Variant = 'nothing-today' | 'all-done' | 'nothing-at-all' | 'nothing-in-range';

/**
 * The empty states.
 *
 * None of them says "no items". An empty list is the most common state this
 * app will ever be in for the person it was designed for, and it is the moment
 * where a nudge is worth more than a status message — so "nothing due today"
 * offers a way to pull one thing in, and "all done" says so and stops.
 */
export function EmptyState({
  variant,
  doneCount = 0,
  unassignedCount = 0,
}: {
  variant: Variant;
  doneCount?: number;
  unassignedCount?: number;
}) {
  const { groups, updateTodo, announce, setFilter } = useTodos();

  if (variant === 'all-done') {
    return (
      <Card>
        <span className="w-[38px] h-[38px] rounded-widget bg-accent-green text-accent-green-dark flex items-center justify-center">
          <CheckIcon size={18} strokeWidth={2.4} />
        </span>
        <strong className="text-13.5 text-text-primary" style={{ fontWeight: 580 }}>
          {doneCount === 1 ? 'That was the one.' : `All ${spell(doneCount)}, done.`}
        </strong>
        <span className="text-12 text-text-muted leading-[1.5]">
          {groups.counts.tomorrow > 0
            ? `Tomorrow has ${groups.counts.tomorrow} waiting — but that's tomorrow.`
            : 'Nothing waiting tomorrow either.'}
        </span>
      </Card>
    );
  }

  if (variant === 'nothing-at-all') {
    return (
      <Card>
        <span className="w-[38px] h-[38px] rounded-widget border-[1.5px] border-dashed border-border-medium" />
        <strong className="text-13.5 text-text-primary" style={{ fontWeight: 580 }}>
          Nothing here yet
        </strong>
        <span className="text-12 text-text-muted leading-[1.5]">
          Type the first thing on your mind. It doesn&rsquo;t need a date.
        </span>
      </Card>
    );
  }

  if (variant === 'nothing-in-range') {
    return (
      <Card>
        <span className="w-[38px] h-[38px] rounded-widget border-[1.5px] border-dashed border-border-medium" />
        <strong className="text-13.5 text-text-primary" style={{ fontWeight: 580 }}>
          Nothing scheduled in this stretch
        </strong>
        <span className="text-12 text-12 text-text-muted leading-[1.5]">
          {unassignedCount > 0
            ? `${unassignedCount} undated to-dos are waiting.`
            : 'Add something, or widen the filter.'}
        </span>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className="text-12.5 text-accent-ink bg-accent-blue rounded-[9px] px-[15px] py-2 font-medium mt-0.5"
        >
          See everything
        </button>
      </Card>
    );
  }

  // nothing-today
  const first = groups.unassigned[0];

  return (
    <Card>
      <span className="w-[38px] h-[38px] rounded-widget border-[1.5px] border-dashed border-border-medium" />
      <strong className="text-13.5 text-text-primary" style={{ fontWeight: 580 }}>
        Nothing due today
      </strong>
      <span className="text-12 text-text-muted leading-[1.5]">
        {unassignedCount > 0
          ? `${spell(unassignedCount)} unassigned to-do${unassignedCount === 1 ? '' : 's'} ${
              unassignedCount === 1 ? 'is' : 'are'
            } waiting. Pull one in?`
          : 'A clear day. Enjoy it, or add something.'}
      </span>
      {first && (
        <button
          type="button"
          onClick={() => {
            updateTodo(first.id, { due_date: todayISO() });
            announce(`Moved ${first.title} to today`);
          }}
          className="text-12.5 text-accent-ink bg-accent-blue rounded-[9px] px-[15px] py-2 font-medium mt-0.5"
        >
          Pick one for today
        </button>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-base border border-border-default rounded-[14px] shadow-card px-[22px] py-[30px] flex flex-col items-center gap-2.5 text-center">
      {children}
    </div>
  );
}

/** "All six, done." reads better than "All 6, done." at these sizes. */
function spell(n: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return words[n] ?? String(n);
}

/** Tomorrow's ISO date — used by the empty states' copy and the FAB flow. */
export function tomorrowISO(): string {
  return toISODate(addDays(new Date(), 1));
}
