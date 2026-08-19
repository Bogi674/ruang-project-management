'use client';

import Link from 'next/link';
import type { TodoFilter } from '@/types';
import { ArrowRightIcon, CalendarIcon, TargetIcon } from './icons';
import { useTodos } from './TodoProvider';

const FILTERS: { value: TodoFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'all', label: 'All' },
];

/**
 * The bar across the top of /todo: what you are looking at, how, and the way
 * out into focus mode.
 *
 * Every control on it is the same 32px high and the same 9px radius. They were
 * not: the segmented range switch sat at 30px, the view toggle at 28, and
 * Focus was a filled, shadowed 34px pill that read as the most important thing
 * on a page where it is the least often used. Uniform height is not tidiness
 * for its own sake — a row of controls at four different sizes has no visual
 * hierarchy left to spend on the thing that actually matters.
 */
const CONTROL = 'h-8 inline-flex items-center rounded-[9px]';

export function TodoFilterBar({ onFocus }: { onFocus: () => void }) {
  const { filter, setFilter, groups } = useTodos();
  const { tomorrow, restOfWeek } = groups.counts;

  return (
    <div className="bg-bg-base border-b border-border-default px-6 py-3 flex items-center gap-2.5 flex-wrap">
      <div role="tablist" aria-label="Time range" className={`${CONTROL} bg-bg-subtle p-[3px]`}>
        {FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(option.value)}
              className={`h-[26px] px-3.5 inline-flex items-center text-12.5 rounded-[7px] transition-colors duration-120 ${
                active
                  ? 'bg-bg-base text-text-primary shadow-card'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              style={{ fontWeight: active ? 580 : 400 }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/*
        What is coming, without leaving Today. Clicking it switches to Week
        rather than opening anything — the question it answers ("is tomorrow
        going to be bad?") is answered by the Week list itself.
      */}
      {filter === 'today' && (tomorrow > 0 || restOfWeek > 0) && (
        <button
          type="button"
          onClick={() => setFilter('week')}
          className={`${CONTROL} hidden sm:inline-flex gap-[7px] text-11.5 text-text-secondary bg-bg-base border border-border-default px-[11px] hover:border-border-medium transition-colors duration-120`}
        >
          <span>
            Tomorrow <b className="font-semibold text-text-primary">{tomorrow}</b>
          </span>
          <span className="text-border-default">·</span>
          <span>
            Rest of week <b className="font-semibold text-text-primary">{restOfWeek}</b>
          </span>
          <ArrowRightIcon size={12} className="text-text-muted" />
        </button>
      )}

      {filter === 'all' && (
        <span className="hidden sm:inline text-11.5 text-text-muted">
          {groups.counts.total} to-dos · {groups.counts.doneThisMonth} done this month
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {/*
          There is one calendar in this app and it is not here. /todo used to
          carry its own month grid behind a List/Calendar switch, which meant
          two calendars with two sets of behaviour, two drag implementations
          and two definitions of what belongs on a day. This goes to the real
          one, where to-dos sit alongside dated notes and reminders.
        */}
        <Link
          href="/calendar"
          className={`${CONTROL} gap-1.5 px-[11px] text-12 text-text-secondary bg-bg-base border border-border-default no-underline hover:border-border-medium hover:text-text-primary transition-colors duration-120`}
        >
          <CalendarIcon size={13} />
          Calendar
        </Link>

        <button
          type="button"
          onClick={onFocus}
          title="One thing at a time (F)"
          className={`${CONTROL} gap-[7px] px-3.5 text-12.5 text-accent-blue-dark bg-accent-blue-bg border border-transparent hover:border-accent-blue transition-colors duration-120`}
          style={{ fontWeight: 580 }}
        >
          <TargetIcon size={13} />
          Focus
        </button>
      </div>
    </div>
  );
}
