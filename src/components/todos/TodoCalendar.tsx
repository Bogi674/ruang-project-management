'use client';

import { useMemo, useState } from 'react';
import { addDays, addMonths, endOfMonth, format, startOfMonth, startOfWeek } from 'date-fns';
import { formatTime, toISODate, todayISO } from '@/lib/todos';
import type { Todo } from '@/types';
import { ChevronLeftIcon, ChevronRightIcon, GripIcon, RepeatIcon } from './icons';
import { useTodoDrag } from './TodoDragContext';
import { useTodos } from './TodoProvider';

/**
 * Month grid with a to-do layer.
 *
 * Structurally the same as `calendar/CalendarView.tsx` — `grid-cols-7`, a mono
 * uppercase weekday header, hairline cell dividers — so the two calendars in
 * the app read as one idea rather than two.
 *
 * Each day cell is a drop group, which is what makes "drag a to-do onto a day"
 * work with no code of its own: the drag controller hit-tests `data-drop-group`
 * and the group key here is the cell's ISO date.
 */
export function TodoCalendar() {
  const { groups, setOpenTodoId } = useTodos();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const today = todayISO();

  // Six rows of seven, Monday-first, starting from the Monday on or before the
  // 1st — the grid always has to be rectangular even when the month is not.
  const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
  const cells = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Todo[]>();
    const add = (todo: Todo) => {
      if (!todo.due_date) return;
      const list = map.get(todo.due_date) || [];
      list.push(todo);
      map.set(todo.due_date, list);
    };
    groups.overdue.forEach(add);
    Object.values(groups.dated).forEach((list) => list.forEach(add));
    Object.values(groups.done).forEach((list) => list.forEach(add));
    return map;
  }, [groups]);

  const monthEnd = endOfMonth(cursor);

  return (
    <div className="flex flex-col md:flex-row" style={{ height: 'var(--app-content-h)' }}>
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-2.5 px-6 py-3 border-b border-border-default">
          <button
            type="button"
            onClick={() => setCursor(addMonths(cursor, -1))}
            aria-label="Previous month"
            className="text-text-muted hover:text-text-secondary transition-colors duration-120"
          >
            <ChevronLeftIcon size={15} strokeWidth={1.7} />
          </button>
          <button
            type="button"
            onClick={() => setCursor(addMonths(cursor, 1))}
            aria-label="Next month"
            className="text-text-muted hover:text-text-secondary transition-colors duration-120"
          >
            <ChevronRightIcon size={15} strokeWidth={1.7} />
          </button>
          <h2
            className="m-0 ml-1.5 font-serif text-[18px] font-normal text-[color:var(--heading-color)]"
            style={{ letterSpacing: '-0.01em' }}
          >
            {format(cursor, 'MMMM yyyy')}
          </h2>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="text-12 text-text-secondary border border-border-default rounded-btn px-3 py-1.5 hover:bg-bg-surface transition-colors duration-120"
          >
            Today
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-border-default flex-shrink-0">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div
              key={day}
              className="text-center py-2.5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-text-faint border-r border-border-light last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-y-auto overscroll-none">
          {cells.map((date) => {
            const iso = toISODate(date);
            const outside = date < startOfMonth(cursor) || date > monthEnd;
            const isToday = iso === today;
            const weekend = date.getDay() === 0 || date.getDay() === 6;
            const items = byDate.get(iso) || [];

            return (
              <div
                key={iso}
                data-drop-group={iso}
                className={`border-r border-b border-border-light last:border-r-0 px-2 py-[7px] flex flex-col gap-1 min-h-[86px] ${
                  weekend ? 'bg-bg-surface' : ''
                }`}
                style={isToday ? { boxShadow: 'inset 0 0 0 1.5px var(--accent-blue)' } : undefined}
              >
                {isToday ? (
                  <span className="w-[22px] h-[22px] rounded-full bg-accent-blue text-accent-ink text-11.5 font-semibold flex items-center justify-center flex-shrink-0">
                    {date.getDate()}
                  </span>
                ) : (
                  <span className={`text-11.5 ${outside ? 'text-text-faint' : 'text-text-secondary'}`}>
                    {date.getDate()}
                  </span>
                )}

                {items.slice(0, 3).map((todo, index) => (
                  <CalendarChip
                    key={todo.id}
                    todo={todo}
                    groupKey={iso}
                    index={index}
                    today={today}
                    onOpen={() => setOpenTodoId(todo.id)}
                  />
                ))}
                {items.length > 3 && (
                  <span className="text-[9.5px] text-text-faint pl-0.5">+{items.length - 3} more</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <CalendarTray todos={groups.unassigned} />
    </div>
  );
}

function CalendarChip({
  todo,
  groupKey,
  index,
  today,
  onOpen,
}: {
  todo: Todo;
  groupKey: string;
  index: number;
  today: string;
  onOpen: () => void;
}) {
  const { start, isDragging } = useTodoDrag();
  const overdue = !todo.is_completed && !!todo.due_date && todo.due_date < today;
  const time = formatTime(todo.due_time);

  return (
    <button
      type="button"
      data-drop-index={index}
      data-todo-id={todo.id}
      onPointerDown={(e) => start(e, todo, groupKey)}
      onClick={onOpen}
      title={todo.title}
      className={`flex items-center gap-1 text-left text-10.5 rounded-[5px] px-1.5 py-[3px] truncate touch-none ${
        isDragging(todo.id) ? 'opacity-40' : ''
      } ${
        todo.is_completed
          ? 'text-text-muted bg-bg-surface line-through'
          : overdue
          ? 'text-accent-amber-dark'
          : time
          ? 'text-accent-blue-dark bg-accent-blue-bg'
          : 'text-text-primary bg-bg-subtle'
      }`}
      style={overdue && !todo.is_completed ? { background: 'var(--chip-note-bg)' } : undefined}
    >
      {todo.recurrence && <RepeatIcon size={10} className="flex-shrink-0 text-text-muted" />}
      <span className="truncate">
        {time && !todo.is_completed ? `${time} ` : ''}
        {todo.title}
      </span>
    </button>
  );
}

/**
 * The Unassigned tray beside the grid.
 *
 * Reused verbatim from the existing calendar's unscheduled tray in intent:
 * drop a chip on a day to schedule it, drag it back here to clear the date.
 */
function CalendarTray({ todos }: { todos: Todo[] }) {
  const { start, isDragging } = useTodoDrag();
  const { setOpenTodoId } = useTodos();

  return (
    <aside
      data-drop-group=""
      className="w-full md:w-[240px] flex-shrink-0 border-t md:border-t-0 md:border-l border-border-default bg-bg-surface px-3.5 py-4 flex flex-col gap-2.5 overflow-y-auto overscroll-none"
    >
      <div className="flex items-center gap-2">
        <h2 className="m-0 text-13 font-semibold text-text-primary">Unassigned</h2>
        <span className="text-10 font-semibold bg-accent-green text-accent-green-dark rounded-full px-[7px] py-[2px]">
          {todos.length}
        </span>
      </div>
      <p className="m-0 text-11 text-text-muted leading-[1.5]">
        Drag onto a day to schedule. Drag back here to clear the date.
      </p>

      {todos.slice(0, 12).map((todo, index) => (
        <div
          key={todo.id}
          data-drop-index={index}
          data-todo-id={todo.id}
          className={`flex items-center gap-2 bg-bg-base border border-border-default rounded-[9px] px-[11px] py-2.5 text-12 ${
            isDragging(todo.id) ? 'opacity-40 border-dashed' : ''
          }`}
        >
          <button
            type="button"
            onPointerDown={(e) => start(e, todo, '')}
            aria-label={`Schedule ${todo.title}`}
            className="text-border-medium cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          >
            <GripIcon size={13} />
          </button>
          <button
            type="button"
            onClick={() => setOpenTodoId(todo.id)}
            className="flex-1 min-w-0 text-left truncate text-text-primary"
          >
            {todo.title}
          </button>
        </div>
      ))}

      {todos.length > 12 && (
        <span className="text-11 text-text-muted">+{todos.length - 12} more</span>
      )}
      {todos.length === 0 && (
        <p className="m-0 text-11 text-text-faint">Nothing undated.</p>
      )}
    </aside>
  );
}
