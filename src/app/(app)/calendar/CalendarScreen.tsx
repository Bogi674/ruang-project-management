'use client';

import { TodoDragProvider } from '@/components/todos/TodoDragContext';
import { TodoProvider } from '@/components/todos/TodoProvider';
import { TodoDetailPanel } from '@/components/todos/TodoDetailPanel';
import type { Note, TodoGroups, Widget } from '@/types';
import { CalendarView } from './CalendarView';

/**
 * The to-do state the calendar sits inside.
 *
 * Same providers the To-do page mounts, so a to-do dragged onto a day here
 * goes through exactly the code path a drag inside a list does — one set of
 * position maths, one optimistic update, one API call. Wrapping rather than
 * duplicating is the whole point of merging the two calendars: there is no
 * second implementation left to drift.
 */
export function CalendarScreen({
  year,
  month,
  day,
  scheduledNotes,
  unscheduledNotes,
  widgets,
  todoGroups,
}: {
  year: number;
  month: number;
  day: number;
  scheduledNotes: Note[];
  unscheduledNotes: Note[];
  widgets: Widget[];
  todoGroups: TodoGroups | null;
}) {
  return (
    <TodoProvider initialGroups={todoGroups} initialFilter="all">
      <TodoDragProvider>
        <CalendarView
          year={year}
          month={month}
          day={day}
          scheduledNotes={scheduledNotes}
          unscheduledNotes={unscheduledNotes}
          widgets={widgets}
        />
        {/* Clicking a to-do chip opens the same detail drawer as the list. */}
        <TodoDetailPanel />
      </TodoDragProvider>
    </TodoProvider>
  );
}
