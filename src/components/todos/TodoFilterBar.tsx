'use client';

import type { TodoFilter } from '@/types';
import { ArrowRightIcon, CalendarIcon, ListIcon, TargetIcon } from './icons';
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
 */
export function TodoFilterBar({ onFocus }: { onFocus: () => void }) {
  const { filter, setFilter, view, setView, groups } = useTodos();
  const { tomorrow, restOfWeek } = groups.counts;

  return (
    <div className="bg-bg-base border-b border-border-default px-6 py-3 flex items-center gap-2.5 flex-wrap">
      <div role="tablist" aria-label="Time range" className="flex bg-bg-subtle rounded-[9px] p-[3px]">
        {FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(option.value)}
              className={`px-3.5 py-1.5 text-12.5 rounded-[7px] transition-colors duration-120 ${
                active ? 'bg-bg-base text-text-primary shadow-card' : 'text-text-secondary hover:text-text-primary'
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
          className="hidden sm:flex items-center gap-[7px] text-11.5 text-text-secondary bg-bg-base border border-border-default rounded-[9px] px-[11px] py-1.5 hover:border-border-medium transition-colors duration-120"
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
        <div className="flex border border-border-default rounded-[9px] overflow-hidden bg-bg-base">
          <ViewButton active={view === 'list'} onClick={() => setView('list')} label="List">
            <ListIcon size={13} />
          </ViewButton>
          <ViewButton
            active={view === 'calendar'}
            onClick={() => setView('calendar')}
            label="Calendar"
            bordered
          >
            <CalendarIcon size={13} />
          </ViewButton>
        </div>

        <button
          type="button"
          onClick={onFocus}
          title="One thing at a time (F)"
          className="flex items-center gap-[7px] text-12.5 text-accent-ink bg-accent-blue rounded-[9px] px-3.5 py-[7px] shadow-fab hover:shadow-fab-hover transition-shadow duration-150"
          style={{ fontWeight: 580 }}
        >
          <TargetIcon size={13} />
          Focus
        </button>
      </div>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  bordered = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 px-[11px] py-1.5 text-12 transition-colors duration-120 ${
        bordered ? 'border-l border-border-default' : ''
      } ${active ? 'bg-bg-subtle text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
      style={{ fontWeight: active ? 580 : 400 }}
    >
      {children}
      {label}
    </button>
  );
}
