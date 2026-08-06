'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Note } from '@/types';
import { extractTitleFromTipTap } from '@/lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

interface CalendarViewProps {
  year: number;
  month: number;
  scheduledNotes: Note[];
  unscheduledNotes: Note[];
}

export function CalendarView({ year, month, scheduledNotes, unscheduledNotes }: CalendarViewProps) {
  const router = useRouter();
  const today = new Date();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrev = new Date(year, month - 1, 0).getDate();

  const prevMonth = month === 1 ? { m: 12, y: year - 1 } : { m: month - 1, y: year };
  const nextMonth = month === 12 ? { m: 1, y: year + 1 } : { m: month + 1, y: year };

  const notesByDate = scheduledNotes.reduce<Record<string, Note[]>>((acc, note) => {
    if (note.pinned_date) {
      const key = note.pinned_date;
      if (!acc[key]) acc[key] = [];
      acc[key].push(note);
    }
    return acc;
  }, {});

  const cells: { day: number; curr: boolean; dateStr: string }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, curr: false, dateStr: '' });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, curr: true, dateStr });
  }
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - firstDay + 1, curr: false, dateStr: '' });

  const isToday = (dateStr: string) =>
    dateStr === today.toISOString().split('T')[0];

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Calendar grid */}
      <div className="flex-1 flex flex-col p-5 overflow-hidden">
        {/* Nav */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <button
            onClick={() => router.push(`/calendar?month=${prevMonth.m}&year=${prevMonth.y}`)}
            className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-secondary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <h2 className="font-serif text-[18px] text-text-primary" style={{ letterSpacing: '-0.01em' }}>
            {MONTHS[month - 1]} {year}
          </h2>
          <button
            onClick={() => router.push(`/calendar?month=${nextMonth.m}&year=${nextMonth.y}`)}
            className="w-8 h-8 flex items-center justify-center text-text-muted hover:text-text-secondary"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1 flex-shrink-0">
          {DAYS.map((d) => (
            <div key={d} className="text-[9.5px] font-mono uppercase tracking-[0.1em] text-text-faint text-center py-1">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 grid grid-cols-7 gap-px bg-border-default overflow-hidden rounded-card">
          {cells.map((cell, i) => {
            const todayCell = cell.curr && isToday(cell.dateStr);
            const notes = cell.dateStr ? notesByDate[cell.dateStr] || [] : [];
            return (
              <div
                key={i}
                className={`bg-bg-base p-1 min-h-[56px] cursor-pointer hover:bg-bg-surface transition-colors duration-80 flex flex-col ${
                  !cell.curr ? 'bg-[#edf1f5] opacity-50 pointer-events-none' : ''
                } ${todayCell ? 'ring-2 ring-inset ring-accent-blue' : ''}`}
              >
                <span
                  className={`self-start text-11 font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full ${
                    todayCell ? 'bg-accent-blue text-white text-[11px]' : 'text-text-secondary'
                  }`}
                >
                  {cell.day}
                </span>
                {notes.slice(0, 2).map((n) => (
                  <Link
                    key={n.id}
                    href={`/note/${n.id}`}
                    className="block text-[10px] px-1.5 py-0.5 rounded bg-accent-green text-accent-green-dark truncate mb-0.5 no-underline hover:bg-accent-green-mid"
                  >
                    {n.title || extractTitleFromTipTap(n.content) || 'Untitled'}
                  </Link>
                ))}
                {notes.length > 2 && (
                  <span className="text-[10px] text-text-faint">+{notes.length - 2}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Unscheduled tray (desktop only) */}
      <aside className="hidden md:flex w-[220px] flex-col border-l border-border-default bg-bg-surface">
        <div className="p-4 border-b border-border-default flex-shrink-0">
          <div className="flex items-center gap-2">
            <p className="text-13 font-semibold text-text-primary">Unscheduled</p>
            {unscheduledNotes.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-accent-green text-accent-green-dark rounded-full">
                {unscheduledNotes.length}
              </span>
            )}
          </div>
          <p className="text-11 text-text-muted mt-0.5">Drag to assign a date</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {unscheduledNotes.length === 0 ? (
            <p className="text-12 text-text-faint">Nothing here. That&apos;s a good sign.</p>
          ) : (
            unscheduledNotes.map((note) => (
              <Link
                key={note.id}
                href={`/note/${note.id}`}
                className="block no-underline p-2.5 bg-bg-base border border-border-default rounded-lg hover:border-accent-blue transition-colors duration-120 cursor-grab"
              >
                <p className="text-12 font-medium text-text-primary truncate">
                  {note.title || extractTitleFromTipTap(note.content) || 'Untitled'}
                </p>
              </Link>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
