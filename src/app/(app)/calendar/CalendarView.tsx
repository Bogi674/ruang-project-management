'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Note, Widget, ReminderContent, LinkContent } from '@/types';
import { extractTitleFromTipTap } from '@/lib/utils';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const VIEW_KEY = 'ruang_calendar_view';
const HOURS = Array.from({ length: 24 }, (_, i) => i);

type CalendarViewType = 'month' | 'week' | 'workweek' | 'day';
type FilterType = 'all' | 'notes' | 'checklists' | 'widgets';

interface CalendarViewProps {
  year: number;
  month: number;
  day: number;
  scheduledNotes: Note[];
  unscheduledNotes: Note[];
  widgets?: Widget[];
}

interface PaneItem {
  id: string;
  kind: 'note' | 'checklist' | 'reminder' | 'file' | 'link';
  title: string;
  href: string;
  isNote: boolean;
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

function formatRangeLabel(start: Date, end: Date) {
  const sm = MONTHS[start.getMonth()];
  const em = MONTHS[end.getMonth()];
  const sy = start.getFullYear();
  const ey = end.getFullYear();
  if (sy !== ey) return `${sm} ${start.getDate()}, ${sy} – ${em} ${end.getDate()}, ${ey}`;
  if (sm !== em) return `${sm} ${start.getDate()} – ${em} ${end.getDate()}, ${sy}`;
  return `${sm} ${start.getDate()}–${end.getDate()}, ${sy}`;
}

function formatHour(h: number) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function getNoteChipStyle(type: string) {
  if (type === 'checklist') return { bg: '#E4F0D0', text: '#4a6a40', dot: '#82b472' };
  return { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' };
}

function getPaneItemStyle(kind: string) {
  if (kind === 'note') return { bg: '#fef9ee', dot: '#f59e0b', text: '#92400e', border: '#fde68a' };
  if (kind === 'checklist') return { bg: '#f0f7eb', dot: '#82b472', text: '#4a6a40', border: '#C2D8B9' };
  return { bg: '#eef4fb', dot: '#A1B5D8', text: '#4a6090', border: '#c8d9ee' };
}

function getWidgetTitle(w: Widget): string {
  if (w.type === 'reminder') return (w.content as ReminderContent).title || 'Reminder';
  if (w.type === 'link') return (w.content as LinkContent).og_title || (w.content as LinkContent).url || 'Link';
  return 'File';
}

export function CalendarView({ year, month, day, scheduledNotes, unscheduledNotes, widgets = [] }: CalendarViewProps) {
  const router = useRouter();
  const today = new Date();
  const todayStr = toDateStr(today);
  const anchor = new Date(year, month - 1, day);

  const [view, setView] = useState<CalendarViewType>('week');
  const [noteList, setNoteList] = useState<Note[]>(scheduledNotes);
  const [unscheduled, setUnscheduled] = useState<Note[]>(unscheduledNotes);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [paneCollapsed, setPaneCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [dragOverPane, setDragOverPane] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(VIEW_KEY) as CalendarViewType | null;
    if (saved && ['month', 'week', 'workweek', 'day'].includes(saved)) setView(saved);
  }, []);

  useEffect(() => {
    if ((view === 'week' || view === 'workweek' || view === 'day') && scrollRef.current) {
      const h = new Date().getHours();
      scrollRef.current.scrollTop = Math.max(0, (h - 2)) * 48;
    }
  }, [view]);

  function changeView(v: CalendarViewType) {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  }

  const notesByDate = noteList.reduce<Record<string, Note[]>>((acc, note) => {
    if (note.pinned_date) {
      acc[note.pinned_date] = [...(acc[note.pinned_date] || []), note];
    }
    return acc;
  }, {});

  const handleDragStart = useCallback((e: React.DragEvent, id: string, fromScheduled: boolean) => {
    e.dataTransfer.setData('noteId', id);
    e.dataTransfer.setData('fromScheduled', String(fromScheduled));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingId(id);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverDate(null);
    setDragOverPane(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverDate(dateStr);
    setDragOverPane(false);
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
    setDraggingId(null);
  }, [unscheduled, noteList]);

  const handleDropOnPane = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverPane(false);
    const noteId = e.dataTransfer.getData('noteId');
    const fromScheduled = e.dataTransfer.getData('fromScheduled') === 'true';
    if (!noteId || !fromScheduled) return;

    await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned_date: null }),
    });

    const note = noteList.find(n => n.id === noteId);
    if (note) {
      setNoteList(prev => prev.filter(n => n.id !== noteId));
      setUnscheduled(prev => [{ ...note, pinned_date: null }, ...prev]);
    }
    setDraggingId(null);
  }, [noteList]);

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

  let cells: Date[] = [];
  let headerLabel = '';

  if (view === 'month') {
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysInPrev = new Date(year, month - 1, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) cells.push(new Date(year, month - 2, daysInPrev - i));
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month - 1, d));
    while (cells.length % 7 !== 0) cells.push(addDays(cells[cells.length - 1], 1));
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
    headerLabel = `${DAY_NAMES_FULL[anchor.getDay()]}, ${MONTHS[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
  }

  const isCurrentMonth = (d: Date) => d.getMonth() === month - 1;

  // Build pane items
  const widgetPaneItems: PaneItem[] = widgets.map(w => ({
    id: w.id,
    kind: w.type as 'reminder' | 'file' | 'link',
    title: getWidgetTitle(w),
    href: w.note_id ? `/note/${w.note_id}` : '#',
    isNote: false,
  }));

  const notePaneItems: PaneItem[] = unscheduled.map(n => ({
    id: n.id,
    kind: n.type as 'note' | 'checklist',
    title: n.title || extractTitleFromTipTap(n.content) || 'Untitled',
    href: `/note/${n.id}`,
    isNote: true,
  }));

  const allPaneItems = [...notePaneItems, ...widgetPaneItems];

  const filteredPaneItems = allPaneItems.filter(item => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'notes' && item.kind === 'note') ||
      (filter === 'checklists' && item.kind === 'checklist') ||
      (filter === 'widgets' && !item.isNote);
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || item.title.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  function NoteChip({ note, fromScheduled }: { note: Note; fromScheduled: boolean }) {
    const title = note.title || extractTitleFromTipTap(note.content) || 'Untitled';
    const style = getNoteChipStyle(note.type || 'note');
    return (
      <div
        draggable
        onDragStart={(e) => handleDragStart(e, note.id, fromScheduled)}
        onDragEnd={handleDragEnd}
        className={`flex items-center gap-1 text-[10.5px] px-1.5 py-[3px] rounded-[4px] mb-0.5 cursor-grab select-none ${draggingId === note.id ? 'opacity-40' : ''}`}
        style={{ background: style.bg, color: style.text }}
      >
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.dot }} />
        <Link
          href={`/note/${note.id}`}
          className="truncate no-underline hover:underline"
          style={{ color: style.text }}
          onClick={e => e.stopPropagation()}
        >
          {title}
        </Link>
      </div>
    );
  }

  function MonthCell({ date, inMonth }: { date: Date; inMonth: boolean }) {
    const dateStr = toDateStr(date);
    const isToday = dateStr === todayStr;
    const isDragTarget = dragOverDate === dateStr;
    const notes = notesByDate[dateStr] || [];
    return (
      <div
        className={`flex flex-col p-1.5 border-b border-r border-border-light transition-colors duration-80 min-h-[90px] ${
          !inMonth ? 'bg-[#f8f9fc]' : 'bg-bg-base'
        } ${isDragTarget ? '!bg-accent-blue-bg' : inMonth ? 'hover:bg-bg-surface' : ''}`}
        onDragOver={inMonth ? (e) => handleDragOver(e, dateStr) : undefined}
        onDragLeave={handleDragLeave}
        onDrop={inMonth ? (e) => handleDrop(e, dateStr) : undefined}
      >
        <span className={`self-start text-[11px] font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 ${
          isToday ? 'bg-accent-blue text-white' : !inMonth ? 'text-text-faint' : 'text-text-secondary'
        }`}>
          {date.getDate()}
        </span>
        {notes.slice(0, 3).map(n => <NoteChip key={n.id} note={n} fromScheduled />)}
        {notes.length > 3 && (
          <span className="text-[9.5px] text-text-faint px-1">+{notes.length - 3} more</span>
        )}
      </div>
    );
  }

  function WeekGrid() {
    const cols = cells.length;
    const colStyle = { gridTemplateColumns: `repeat(${cols}, 1fr)` };

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* All-day row */}
        <div className="flex flex-shrink-0 border-b border-border-default" style={{ minHeight: 52 }}>
          <div className="w-14 flex-shrink-0 flex items-end justify-end pr-2 pb-1.5">
            <span className="text-[9px] text-text-faint uppercase tracking-[0.07em]">all day</span>
          </div>
          {cells.map((date, i) => {
            const dateStr = toDateStr(date);
            const isToday = dateStr === todayStr;
            const notes = notesByDate[dateStr] || [];
            const isDragTarget = dragOverDate === dateStr;
            return (
              <div
                key={i}
                className={`flex-1 border-l border-border-light p-1 transition-colors ${
                  isToday ? 'bg-[#f4f8ff]' : ''
                } ${isDragTarget ? '!bg-accent-blue-bg' : 'hover:bg-bg-surface'}`}
                onDragOver={(e) => handleDragOver(e, dateStr)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, dateStr)}
              >
                {notes.map(n => <NoteChip key={n.id} note={n} fromScheduled />)}
              </div>
            );
          })}
        </div>

        {/* Scrollable time grid */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="relative" style={{ height: `${24 * 48}px` }}>
            {HOURS.map(h => (
              <div key={h} className="absolute w-full flex" style={{ top: h * 48, height: 48 }}>
                <div className="w-14 flex-shrink-0 flex items-start justify-end pr-2 -mt-2.5">
                  {h > 0 && (
                    <span className="text-[9px] text-text-faint leading-none">{formatHour(h)}</span>
                  )}
                </div>
                <div className="flex-1 border-t border-border-light" style={{ display: 'grid', ...colStyle }}>
                  {cells.map((_, i) => (
                    <div key={i} className="border-l border-border-light h-full" />
                  ))}
                </div>
              </div>
            ))}

            {/* Current time line */}
            {(() => {
              const now = new Date();
              const isCurrentPeriod = cells.some(c => toDateStr(c) === todayStr);
              if (!isCurrentPeriod) return null;
              const top = (now.getHours() * 60 + now.getMinutes()) / 60 * 48;
              return (
                <div className="absolute pointer-events-none z-10 flex items-center" style={{ top: top - 1, left: 56, right: 0 }}>
                  <div className="w-2 h-2 rounded-full bg-accent-blue flex-shrink-0 -ml-1" />
                  <div className="flex-1 h-px bg-accent-blue" />
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-52px)] bg-bg-base">
      {/* Main calendar */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border-default flex-shrink-0 bg-bg-base">
          <button
            onClick={() => navigate(-1)}
            className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-secondary rounded-lg hover:bg-bg-surface transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button
            onClick={() => navigate(1)}
            className="w-7 h-7 flex items-center justify-center text-text-muted hover:text-text-secondary rounded-lg hover:bg-bg-surface transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>

          <h2 className="font-serif text-[17px] text-text-primary flex-1 ml-1" style={{ letterSpacing: '-0.01em' }}>
            {headerLabel}
          </h2>

          <button
            onClick={goToday}
            className="text-[12px] text-text-secondary border border-border-default rounded-lg px-3 py-1.5 hover:bg-bg-surface transition-colors"
          >
            Today
          </button>

          <div className="flex items-center border border-border-default rounded-lg overflow-hidden">
            {(['day', 'week', 'workweek', 'month'] as CalendarViewType[]).map(v => (
              <button
                key={v}
                onClick={() => changeView(v)}
                className={`px-3 py-1.5 text-[12px] transition-colors duration-120 ${
                  view === v ? 'bg-accent-blue text-white font-medium' : 'text-text-secondary hover:bg-bg-surface'
                }`}
              >
                {v === 'workweek' ? 'Work week' : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers for week/day views */}
        {view !== 'month' && (
          <div className="flex flex-shrink-0 border-b border-border-default bg-bg-base">
            <div className="w-14 flex-shrink-0" />
            {cells.map((d, i) => {
              const isToday = toDateStr(d) === todayStr;
              return (
                <div key={i} className="flex-1 border-l border-border-light text-center py-2">
                  <div className={`text-[10px] font-mono uppercase tracking-[0.08em] ${isToday ? 'text-accent-blue-dark font-semibold' : 'text-text-faint'}`}>
                    {DAY_NAMES[d.getDay()]}
                  </div>
                  <div className={`text-[18px] font-light mt-0.5 w-8 h-8 mx-auto flex items-center justify-center rounded-full ${
                    isToday ? 'bg-accent-blue text-white' : 'text-text-secondary'
                  }`}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Calendar body */}
        {view === 'month' ? (
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-7 border-b border-border-default bg-bg-base sticky top-0 z-10">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center py-2 text-[9.5px] font-mono uppercase tracking-[0.1em] text-text-faint border-r border-border-light last:border-r-0">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((date, i) => (
                <MonthCell key={i} date={date} inMonth={isCurrentMonth(date)} />
              ))}
            </div>
          </div>
        ) : (
          <WeekGrid />
        )}
      </div>

      {/* Unscheduled pane */}
      <aside
        className={`hidden md:flex flex-col border-l border-border-default bg-bg-base flex-shrink-0 transition-all duration-200 ${paneCollapsed ? 'w-10' : 'w-[265px]'} ${
          dragOverPane && !paneCollapsed ? 'bg-accent-blue-bg' : ''
        }`}
        onDragOver={!paneCollapsed ? (e) => { e.preventDefault(); setDragOverPane(true); } : undefined}
        onDragLeave={!paneCollapsed ? () => setDragOverPane(false) : undefined}
        onDrop={!paneCollapsed ? handleDropOnPane : undefined}
      >
        {paneCollapsed ? (
          <button
            onClick={() => setPaneCollapsed(false)}
            className="flex-1 flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors"
            title="Show unscheduled"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
        ) : (
          <>
            {/* Pane header */}
            <div className="px-4 pt-3.5 pb-3 border-b border-border-default flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text-primary">Unscheduled</span>
                  {allPaneItems.length > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-accent-green text-accent-green-dark rounded-full">
                      {allPaneItems.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setPaneCollapsed(true)}
                  className="w-6 h-6 flex items-center justify-center text-text-faint hover:text-text-muted transition-colors rounded hover:bg-bg-surface"
                  title="Collapse"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="m9 18 6-6-6-6"/></svg>
                </button>
              </div>

              {/* Search */}
              <div className="relative mb-2.5">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-8 pl-7 pr-3 text-[12px] rounded-[8px] border border-border-medium bg-bg-surface placeholder:text-text-faint text-text-primary outline-none focus:border-accent-blue transition-colors"
                />
              </div>

              {/* Filter pills */}
              <div className="flex gap-1 flex-wrap">
                {(['all', 'notes', 'checklists', 'widgets'] as FilterType[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-[10.5px] px-2.5 py-0.5 rounded-full border transition-colors ${
                      filter === f
                        ? 'bg-accent-blue text-white border-accent-blue'
                        : 'border-border-default text-text-muted hover:border-accent-blue hover:text-accent-blue-dark bg-bg-surface'
                    }`}
                  >
                    {f === 'widgets' ? 'Widgets' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredPaneItems.length === 0 ? (
                <p className="text-[12px] text-text-faint text-center py-6">
                  {searchQuery
                    ? `Nothing found for "${searchQuery}"`
                    : 'Nothing here. That\'s a good sign.'}
                </p>
              ) : (
                filteredPaneItems.map(item => {
                  const style = getPaneItemStyle(item.kind);
                  return (
                    <div
                      key={item.id}
                      draggable={item.isNote}
                      onDragStart={item.isNote ? (e) => handleDragStart(e, item.id, false) : undefined}
                      onDragEnd={item.isNote ? handleDragEnd : undefined}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-[8px] border select-none transition-all duration-120 ${
                        draggingId === item.id ? 'opacity-40 scale-95' : 'hover:shadow-sm'
                      } ${item.isNote ? 'cursor-grab' : 'cursor-default'}`}
                      style={{ background: style.bg, borderColor: style.border }}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: style.dot }} />
                      <Link
                        href={item.href}
                        className="flex-1 text-[12px] font-medium truncate no-underline hover:underline"
                        style={{ color: style.text }}
                      >
                        {item.title}
                      </Link>
                      <span className="text-[9px] capitalize flex-shrink-0" style={{ color: style.dot }}>
                        {item.kind}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {filteredPaneItems.length > 0 && (
              <div className={`px-4 py-2.5 border-t border-border-light flex-shrink-0 transition-colors ${dragOverPane ? 'bg-accent-blue-bg' : ''}`}>
                <p className="text-[10px] text-text-faint">
                  {dragOverPane ? 'Drop here to unschedule' : 'Drag to calendar to assign a date'}
                </p>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
