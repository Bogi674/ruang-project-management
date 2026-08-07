'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Note } from '@/types';
import { extractTitleFromTipTap } from '@/lib/utils';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const VIEW_KEY = 'ruang_calendar_view';

type CalendarView = 'month' | 'week' | 'workweek' | 'day';

interface CalendarViewProps {
  year: number;
  month: number;
  day: number;
  scheduledNotes: Note[];
  unscheduledNotes: Note[];
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  return r;
}

function startOfWorkWeek(d: Date) {
  const r = new Date(d);
  const day = r.getDay();
  r.setDate(r.getDate() - (day === 0 ? 6 : day - 1));
  return r;
}

function formatShortDate(d: Date) {
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
}

function formatRangeLabel(start: Date, end: Date) {
  const sm = MONTHS[start.getMonth()];
  const em = MONTHS[end.getMonth()];
  const sy = start.getFullYear();
  const ey = end.getFullYear();
  if (sy !== ey) return `${sm} ${start.getDate()}, ${sy} – ${em} ${end.getDate()}, ${ey}`;
  if (sm !== em) return `${sm} ${start.getDate()} – ${em} ${end.getDate()}, ${sy}`;
  return `${sm} ${start.getDate()}–${end.getDate()}, ${sy}`;
}

export function CalendarView({ year, month, day, scheduledNotes, unscheduledNotes }: CalendarViewProps) {
  const router = useRouter();
  const today = new Date();
  const todayStr = toDateStr(today);
  const anchor = new Date(year, month - 1, day);

  const [view, setView] = useState<CalendarView>('week');
  const [noteList, setNoteList] = useState<Note[]>(scheduledNotes);
  const [unscheduled, setUnscheduled] = useState<Note[]>(unscheduledNotes);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY) as CalendarView | null;
    if (saved && ['month', 'week', 'workweek', 'day'].includes(saved)) setView(saved);
  }, []);

  function changeView(v: CalendarView) {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  }

  const notesByDate = noteList.reduce<Record<string, Note[]>>((acc, note) => {
    if (note.pinned_date) {
      acc[note.pinned_date] = [...(acc[note.pinned_date] || []), note];
    }
    return acc;
  }, {});

  const handleDragStart = useCallback((e: React.DragEvent, noteId: string) => {
    e.dataTransfer.setData('noteId', noteId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingNoteId(noteId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingNoteId(null);
    setDragOverDate(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateStr);
  }, []);

  const handleDragLeave = useCallback(() => setDragOverDate(null), []);

  const handleDrop = useCallback(async (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const noteId = e.dataTransfer.getData('noteId');
    if (!noteId || !dateStr) return;

    await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned_date: dateStr }),
    });

    const movedNote = unscheduled.find(n => n.id === noteId) || noteList.find(n => n.id === noteId);
    if (movedNote) {
      const updated = { ...movedNote, pinned_date: dateStr };
      setNoteList(prev => [...prev.filter(n => n.id !== noteId), updated]);
      setUnscheduled(prev => prev.filter(n => n.id !== noteId));
    }
    setDraggingNoteId(null);
  }, [unscheduled, noteList]);

  function navigate(delta: number) {
    let next = new Date(anchor);
    if (view === 'month') {
      next = new Date(year, month - 1 + delta, 1);
    } else if (view === 'week' || view === 'workweek') {
      next = addDays(anchor, delta * 7);
    } else {
      next = addDays(anchor, delta);
    }
    router.push(`/calendar?year=${next.getFullYear()}&month=${next.getMonth() + 1}&day=${next.getDate()}`);
  }

  function goToday() {
    router.push(`/calendar?year=${today.getFullYear()}&month=${today.getMonth() + 1}&day=${today.getDate()}`);
  }

  // ---- Build cells for the current view ----
  let cells: Date[] = [];
  let headerLabel = '';

  if (view === 'month') {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysInPrev = new Date(year, month - 1, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      cells.push(new Date(year, month - 2, daysInPrev - i));
    }
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month - 1, d));
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1];
      cells.push(addDays(last, 1));
    }
    headerLabel = `${MONTHS[month - 1]} ${year}`;
  } else if (view === 'week') {
    const start = startOfWeek(anchor);
    cells = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    headerLabel = formatRangeLabel(cells[0], cells[6]);
  } else if (view === 'workweek') {
    const start = startOfWorkWeek(anchor);
    cells = Array.from({ length: 5 }, (_, i) => addDays(start, i));
    headerLabel = formatRangeLabel(cells[0], cells[4]);
  } else {
    cells = [anchor];
    headerLabel = `${DAY_NAMES[anchor.getDay()]}, ${MONTHS[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
  }

  const isCurrentMonth = (d: Date) => d.getMonth() === month - 1;

  function NoteChip({ note, maxLines = 1 }: { note: Note; maxLines?: number }) {
    const title = note.title || extractTitleFromTipTap(note.content) || 'Untitled';
    return (
      <Link
        href={`/note/${note.id}`}
        className={`block text-[10px] px-1.5 py-0.5 rounded bg-accent-green text-accent-green-dark truncate mb-0.5 no-underline hover:bg-accent-green-mid ${maxLines > 1 ? 'whitespace-normal line-clamp-2' : ''}`}
      >
        {title}
      </Link>
    );
  }

  function DayCell({ date, inMonth = true }: { date: Date; inMonth?: boolean }) {
    const dateStr = toDateStr(date);
    const isToday = dateStr === todayStr;
    const isDragTarget = dragOverDate === dateStr;
    const notes = notesByDate[dateStr] || [];
    const maxVisible = view === 'day' ? 50 : view === 'week' || view === 'workweek' ? 5 : 2;

    return (
      <div
        className={`flex flex-col p-1 transition-colors duration-80 ${
          !inMonth && view === 'month' ? 'bg-[#f0f2f6] pointer-events-none' : ''
        } ${isToday && view === 'month' ? 'ring-2 ring-inset ring-accent-blue' : ''} ${
          isDragTarget ? 'bg-accent-blue-bg' : inMonth ? 'hover:bg-bg-surface' : ''
        } ${view !== 'month' ? 'min-h-[120px]' : 'min-h-[64px]'}`}
        onDragOver={inMonth ? (e) => handleDragOver(e, dateStr) : undefined}
        onDragLeave={handleDragLeave}
        onDrop={inMonth ? (e) => handleDrop(e, dateStr) : undefined}
      >
        <span className={`self-start text-[11px] font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
          isToday ? 'bg-accent-blue text-white' : !inMonth ? 'text-text-faint' : 'text-text-secondary'
        }`}>
          {date.getDate()}
        </span>
        {notes.slice(0, maxVisible).map(n => <NoteChip key={n.id} note={n} />)}
        {notes.length > maxVisible && (
          <span className="text-[10px] text-text-faint">+{notes.length - maxVisible} more</span>
        )}
      </div>
    );
  }

  const cols = view === 'month' ? 7 : view === 'workweek' ? 5 : view === 'week' ? 7 : 1;
  const dayHeaders = view === 'month' ? DAY_NAMES :
    view === 'workweek' ? DAY_NAMES.slice(1, 6) :
    view === 'week' ? DAY_NAMES :
    [DAY_NAMES[anchor.getDay()]];

  return (
    <div className="flex h-[calc(100vh-52px)]">
      {/* Main calendar area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 flex-shrink-0 border-b border-border-default">
          {/* Prev / Next */}
          <button onClick={() => navigate(-1)} className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-secondary rounded-lg hover:bg-bg-surface transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button onClick={() => navigate(1)} className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-secondary rounded-lg hover:bg-bg-surface transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>

          <h2 className="font-serif text-[17px] text-text-primary flex-1" style={{ letterSpacing: '-0.01em' }}>{headerLabel}</h2>

          <button
            onClick={goToday}
            className="text-[12px] text-text-secondary border border-border-default rounded-lg px-3 py-1.5 hover:bg-bg-surface transition-colors"
          >Today</button>

          {/* View selector */}
          <div className="flex items-center bg-bg-surface border border-border-default rounded-lg overflow-hidden">
            {(['day', 'week', 'workweek', 'month'] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => changeView(v)}
                className={`px-3 py-1.5 text-[12px] transition-colors duration-120 ${
                  view === v
                    ? 'bg-accent-blue text-white font-medium'
                    : 'text-text-secondary hover:bg-border-light'
                }`}
              >
                {v === 'workweek' ? 'Work week' : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Day column headers (not for day view) */}
        {view !== 'day' && (
          <div className={`grid flex-shrink-0 border-b border-border-default`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {(view === 'week' || view === 'workweek' ? cells : dayHeaders.map((_, i) => i)).map((item, i) => {
              if (view === 'week' || view === 'workweek') {
                const d = item as Date;
                const isToday = toDateStr(d) === todayStr;
                return (
                  <div key={i} className={`text-center py-2 text-[11px] ${isToday ? 'text-accent-blue-dark font-semibold' : 'text-text-faint font-mono uppercase tracking-[0.08em]'}`}>
                    {DAY_NAMES[d.getDay()]} <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${isToday ? 'bg-accent-blue text-white' : ''}`}>{d.getDate()}</span>
                  </div>
                );
              }
              return (
                <div key={i} className="text-center py-1 text-[9.5px] font-mono uppercase tracking-[0.1em] text-text-faint">{dayHeaders[i]}</div>
              );
            })}
          </div>
        )}

        {/* Grid */}
        <div
          className="flex-1 grid gap-px bg-border-default overflow-auto"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, alignContent: 'start' }}
        >
          {(view === 'month' ? cells : cells).map((date, i) => (
            <DayCell
              key={i}
              date={date as Date}
              inMonth={view === 'month' ? isCurrentMonth(date as Date) : true}
            />
          ))}
        </div>
      </div>

      {/* Unscheduled tray (desktop only) */}
      <aside className="hidden md:flex w-[220px] flex-col border-l border-border-default bg-bg-surface flex-shrink-0">
        <div className="p-4 border-b border-border-default flex-shrink-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-semibold text-text-primary">Unscheduled</p>
            {unscheduled.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-accent-green text-accent-green-dark rounded-full">
                {unscheduled.length}
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-muted mt-0.5">Drag to assign a date</p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {unscheduled.length === 0 ? (
            <p className="text-[12px] text-text-faint">Nothing here. That&apos;s a good sign.</p>
          ) : (
            unscheduled.map((note) => (
              <div
                key={note.id}
                draggable
                onDragStart={(e) => handleDragStart(e, note.id)}
                onDragEnd={handleDragEnd}
                className={`p-2.5 bg-bg-base border border-border-default rounded-[10px] cursor-grab select-none transition-all duration-120 ${
                  draggingNoteId === note.id ? 'opacity-50 scale-95' : 'hover:border-accent-blue hover:shadow-sm'
                }`}
              >
                <p className="text-[12px] font-medium text-text-primary truncate">
                  {note.title || extractTitleFromTipTap(note.content) || 'Untitled'}
                </p>
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
