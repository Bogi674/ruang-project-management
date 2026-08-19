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

const CONTROL = 'h-8 inline-flex items-center rounded-[9px]';

export function TodoFilterBar({ onFocus }: { onFocus: () => void }) {
  const { filter, setFilter, groups } = useTodos();
  const { tomorrow, restOfWeek } = groups.counts;
  const activeLabel = FILTERS.find((f) => f.value === filter)?.label ?? 'Today';

  return (
    <div className="bg-bg-base border-b border-border-default px-4 md:px-6 py-3 flex items-center gap-2.5">
      {/* ── Mobile: dropdown pill (replaces segmented tabs on narrow screens) ── */}
      <div className="md:hidden relative">
        <button
          type="button"
          onClick={() => {
            const options = FILTERS.map((f) => f.value);
            const idx = options.indexOf(filter);
            setFilter(options[(idx + 1) % options.length]);
          }}
          className="h-9 inline-flex items-center gap-2 bg-bg-subtle border border-border-default rounded-[10px] px-3.5 text-13 font-semibold text-text-primary"
          aria-label="Change time range"
        >
          {activeLabel}
          <svg width="9" height="6" viewBox="0 0 9 6" fill="none" aria-hidden="true">
            <path d="M1 1L4.5 5L8 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
          </svg>
        </button>
        {/* Hidden native select for accessibility — positioned over the button */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as TodoFilter)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          aria-label="Time range"
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {/* ── Desktop: segmented tablist ── */}
      <div role="tablist" aria-label="Time range" className={`hidden md:inline-flex ${CONTROL} bg-bg-subtle p-[3px]`}>
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
        <Link
          href="/calendar"
          className={`${CONTROL} gap-1.5 px-[11px] text-12 text-text-secondary bg-bg-base border border-border-default no-underline hover:border-border-medium hover:text-text-primary transition-colors duration-120`}
        >
          <CalendarIcon size={13} />
          <span className="hidden sm:inline">Calendar</span>
        </Link>

        <button
          type="button"
          onClick={onFocus}
          title="One thing at a time (F)"
          className={`${CONTROL} gap-[7px] px-3 md:px-3.5 text-12.5 text-accent-blue-dark bg-accent-blue-bg border border-transparent hover:border-accent-blue transition-colors duration-120`}
          style={{ fontWeight: 580 }}
        >
          <TargetIcon size={13} />
          <span className="hidden sm:inline">Focus</span>
        </button>
      </div>
    </div>
  );
}
