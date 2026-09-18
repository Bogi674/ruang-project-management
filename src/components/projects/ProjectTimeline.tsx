'use client';

import { useState } from 'react';
import { Workstream, ProjectEntry } from '@/types';
import { EntryTypeIcon } from './EntryTypeIcon';

interface ProjectTimelineProps {
  project: {
    id: string;
    color: string;
    workstreams: Workstream[];
    entries: ProjectEntry[];
  };
  onEntryClick: (entry: ProjectEntry) => void;
  onEntryUpdate: (entryId: string, data: Partial<ProjectEntry>) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COL_W = 52;
const LEFT_W = 240;

function getMondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun,1=Mon,...
  const diff = day === 0 ? -6 : 1 - day;
  const m = new Date(d);
  m.setDate(m.getDate() + diff);
  m.setHours(0, 0, 0, 0);
  return m;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatRange(start: Date): string {
  const end = addDays(start, 6);
  const sm = start.toLocaleDateString('en-US', { month: 'short' });
  const em = end.toLocaleDateString('en-US', { month: 'short' });
  const sy = start.getFullYear();
  const ey = end.getFullYear();
  if (sm === em && sy === ey) {
    return `${sm} ${start.getDate()}–${end.getDate()}, ${sy}`;
  }
  return `${sm} ${start.getDate()} – ${em} ${end.getDate()}, ${ey}`;
}

function chipColors(type: string, status: string | undefined, projectColor: string) {
  if (type === 'task') {
    if (status === 'done') {
      return { background: 'var(--accent-green)', border: '1px solid var(--accent-green-mid)', color: 'var(--accent-green-dark)', textDecoration: 'line-through' as const };
    }
    return { background: 'var(--bg-subtle)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)', textDecoration: 'none' as const };
  }
  if (type === 'reminder') {
    return { background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-dark)', textDecoration: 'none' as const };
  }
  if (type === 'link') {
    return { background: '#f0eeff', border: '1px solid #d4c8f8', color: '#5a40a0', textDecoration: 'none' as const };
  }
  // note / file
  return { background: `${projectColor}1F`, border: `1px solid ${projectColor}40`, color: 'var(--text-primary)', textDecoration: 'none' as const };
}

export function ProjectTimeline({ project, onEntryClick }: ProjectTimelineProps) {
  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [unscheduledOpen, setUnscheduledOpen] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayIso = isoDate(new Date());

  function toggleWs(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const unscheduled = project.entries.filter((e) => !e.pinned_date);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* Toolbar */}
      <div style={{ height: 36, display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', flexShrink: 0 }}>
        <button
          onClick={() => setWeekStart((d) => addDays(d, -7))}
          style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
        >
          ‹ Prev
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
          {formatRange(weekStart)}
        </span>
        <button
          onClick={() => setWeekStart((d) => addDays(d, 7))}
          style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
        >
          Next ›
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>Week</span>
      </div>

      {/* Body: left panel + scrollable grid + unscheduled tab */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left frozen panel */}
        <div style={{ width: LEFT_W, flexShrink: 0, background: 'var(--bg-subtle)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Top cell matching date header height */}
          <div style={{ height: 36, flexShrink: 0, borderBottom: '1px solid var(--border-default)', background: 'var(--bg-surface)' }} />

          {/* Workstream rows */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {project.workstreams.map((ws) => {
              const isCollapsed = collapsed.has(ws.id);
              const wsEntries = project.entries.filter((e) => e.workstream_id === ws.id);
              return (
                <div key={ws.id}>
                  <div
                    onClick={() => toggleWs(ws.id)}
                    style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', cursor: 'pointer', borderLeft: `3px solid ${ws.color}`, borderBottom: '1px solid var(--border-light)' }}
                    className="timeline-ws-row"
                  >
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', userSelect: 'none' }}>{isCollapsed ? '▸' : '▾'}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                  </div>
                  {!isCollapsed && wsEntries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => onEntryClick(entry)}
                      style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 0 20px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}
                      className="timeline-entry-row"
                    >
                      <EntryTypeIcon type={entry.type} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                        {entry.title || 'Untitled'}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Unassigned workstream entries */}
            {(() => {
              const unassigned = project.entries.filter((e) => !e.workstream_id);
              if (unassigned.length === 0) return null;
              const isCollapsed = collapsed.has('__none__');
              return (
                <div>
                  <div
                    onClick={() => toggleWs('__none__')}
                    style={{ height: 36, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', cursor: 'pointer', borderLeft: '3px solid var(--border-medium)', borderBottom: '1px solid var(--border-light)' }}
                    className="timeline-ws-row"
                  >
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', userSelect: 'none' }}>{isCollapsed ? '▸' : '▾'}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-secondary)', flex: 1 }}>No workstream</span>
                  </div>
                  {!isCollapsed && unassigned.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => onEntryClick(entry)}
                      style={{ height: 32, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px 0 20px', cursor: 'pointer', borderBottom: '1px solid var(--border-light)' }}
                      className="timeline-entry-row"
                    >
                      <EntryTypeIcon type={entry.type} />
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                        {entry.title || 'Untitled'}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div style={{ padding: '10px 14px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer' }}>+ Add Workstream</span>
            </div>
          </div>
        </div>

        {/* Scrollable grid area */}
        <div style={{ flex: 1, overflowX: 'auto', display: 'flex', flexDirection: 'column' }}>
          <style>{`
            .timeline-ws-row:hover { background: var(--bg-elevated); }
            .timeline-entry-row:hover { background: var(--bg-elevated); }
            .timeline-chip:hover { transform: scale(1.01); box-shadow: 0 2px 6px rgba(44,56,72,.1); }
          `}</style>

          {/* Date header row */}
          <div style={{ height: 36, display: 'flex', flexShrink: 0, borderBottom: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>
            {weekDays.map((day, i) => {
              const iso = isoDate(day);
              const isToday = iso === todayIso;
              const isWeekend = i >= 5;
              return (
                <div
                  key={iso}
                  style={{ width: COL_W, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: isWeekend ? 'rgba(0,0,0,0.015)' : undefined }}
                >
                  <span style={{ fontSize: 10, color: isToday ? '#FBB040' : 'var(--text-faint)' }}>{DAYS[i]}</span>
                  {isToday ? (
                    <span style={{ background: '#FBB040', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff' }}>
                      {day.getDate()}
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{day.getDate()}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Grid rows */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {project.workstreams.map((ws) => {
              const isCollapsed = collapsed.has(ws.id);
              const wsEntries = project.entries.filter((e) => e.workstream_id === ws.id);
              return (
                <div key={ws.id}>
                  {/* Workstream header row */}
                  <div style={{ height: 36, display: 'flex', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-light)' }}>
                    {weekDays.map((day, i) => {
                      const iso = isoDate(day);
                      const isToday = iso === todayIso;
                      const isWeekend = i >= 5;
                      return (
                        <div key={iso} style={{ width: COL_W, flexShrink: 0, borderRight: '1px solid var(--border-light)', background: isToday ? 'rgba(251,176,64,0.06)' : isWeekend ? 'rgba(0,0,0,0.015)' : undefined }} />
                      );
                    })}
                  </div>

                  {/* Entry sub-rows */}
                  {!isCollapsed && wsEntries.map((entry) => (
                    <GridEntryRow
                      key={entry.id}
                      entry={entry}
                      weekDays={weekDays}
                      todayIso={todayIso}
                      projectColor={project.color}
                      onEntryClick={onEntryClick}
                    />
                  ))}
                </div>
              );
            })}

            {/* Unassigned workstream grid rows */}
            {(() => {
              const unassigned = project.entries.filter((e) => !e.workstream_id);
              if (unassigned.length === 0) return null;
              const isCollapsed = collapsed.has('__none__');
              return (
                <div>
                  <div style={{ height: 36, display: 'flex', background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-light)' }}>
                    {weekDays.map((day, i) => {
                      const iso = isoDate(day);
                      const isToday = iso === todayIso;
                      const isWeekend = i >= 5;
                      return (
                        <div key={iso} style={{ width: COL_W, flexShrink: 0, borderRight: '1px solid var(--border-light)', background: isToday ? 'rgba(251,176,64,0.06)' : isWeekend ? 'rgba(0,0,0,0.015)' : undefined }} />
                      );
                    })}
                  </div>
                  {!isCollapsed && unassigned.map((entry) => (
                    <GridEntryRow
                      key={entry.id}
                      entry={entry}
                      weekDays={weekDays}
                      todayIso={todayIso}
                      projectColor={project.color}
                      onEntryClick={onEntryClick}
                    />
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Unscheduled vertical tab */}
        <div style={{ flexShrink: 0, display: 'flex' }}>
          {unscheduledOpen ? (
            <div style={{ width: 220, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '10px 12px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-faint)' }}>Unscheduled</span>
                <button onClick={() => setUnscheduledOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>×</button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, padding: '4px 8px' }}>
                {unscheduled.map((entry) => {
                  const colors = chipColors(entry.type, entry.status, project.color);
                  return (
                    <div
                      key={entry.id}
                      onClick={() => onEntryClick(entry)}
                      className="timeline-chip"
                      style={{ height: 26, borderRadius: 6, padding: '0 8px', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none', marginBottom: 4, transition: 'transform 0.1s, box-shadow 0.1s', ...colors }}
                    >
                      <span style={{ flexShrink: 0 }}><EntryTypeIcon type={entry.type} /></span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: colors.textDecoration }}>
                        {entry.title || 'Untitled'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              onClick={() => setUnscheduledOpen(true)}
              style={{ width: 28, background: 'var(--bg-surface)', borderLeft: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
            >
              <span style={{ fontSize: 11, color: 'var(--text-muted)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap', userSelect: 'none' }}>
                Unscheduled ▸ {unscheduled.length}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Extracted grid row component — renders the 7-cell row for one entry
function GridEntryRow({ entry, weekDays, todayIso, projectColor, onEntryClick }: {
  entry: ProjectEntry;
  weekDays: Date[];
  todayIso: string;
  projectColor: string;
  onEntryClick: (e: ProjectEntry) => void;
}) {
  const colors = chipColors(entry.type, entry.status, projectColor);

  // Find which columns this entry spans
  let startCol = -1;
  let endCol = -1;
  if (entry.pinned_date) {
    weekDays.forEach((day, i) => {
      const iso = isoDate(day);
      if (iso === entry.pinned_date) startCol = i;
      if (entry.pinned_date_end ? iso === entry.pinned_date_end : iso === entry.pinned_date) endCol = i;
    });
    // If start is before week, clamp to 0
    if (startCol === -1 && entry.pinned_date < isoDate(weekDays[0])) startCol = 0;
    if (endCol === -1 && entry.pinned_date_end && entry.pinned_date_end > isoDate(weekDays[6])) endCol = 6;
    if (startCol === -1 && entry.pinned_date > isoDate(weekDays[6])) { startCol = -2; } // outside week
  }

  return (
    <div style={{ height: 32, display: 'flex', position: 'relative', borderBottom: '1px solid var(--border-light)' }}>
      {weekDays.map((day, i) => {
        const iso = isoDate(day);
        const isToday = iso === todayIso;
        const isWeekend = i >= 5;
        return (
          <div
            key={iso}
            style={{ width: COL_W, flexShrink: 0, borderRight: '1px solid var(--border-light)', background: isToday ? 'rgba(251,176,64,0.06)' : isWeekend ? 'rgba(0,0,0,0.015)' : undefined }}
          />
        );
      })}

      {/* Chip overlay — positioned absolute over the cells */}
      {startCol >= 0 && endCol >= 0 && (
        <div
          className="timeline-chip"
          onClick={() => onEntryClick(entry)}
          style={{
            position: 'absolute',
            top: 3,
            height: 26,
            left: startCol === endCol ? startCol * COL_W + 2 : startCol * COL_W,
            width: startCol === endCol ? COL_W - 4 : (endCol - startCol + 1) * COL_W - 4,
            borderRadius: 6,
            padding: '0 8px',
            fontSize: 11.5,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'transform 0.1s, box-shadow 0.1s',
            zIndex: 1,
            overflow: 'hidden',
            ...colors,
          }}
        >
          <span style={{ flexShrink: 0 }}><EntryTypeIcon type={entry.type} /></span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: colors.textDecoration }}>
            {entry.title || 'Untitled'}
          </span>
        </div>
      )}
    </div>
  );
}
