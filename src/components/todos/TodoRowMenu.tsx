'use client';

import { addDays } from 'date-fns';
import { toISODate, todayISO } from '@/lib/todos';
import type { Todo } from '@/types';
import { AnchoredPanel } from './AnchoredPanel';
import { useTodoActions } from './TodoProvider';

/**
 * The overflow menu on a to-do row.
 *
 * It carries the moves that drag-and-drop covers on a desktop — today,
 * tomorrow, unassign — because a phone user who cannot comfortably drag a row
 * from one date group to another still has to be able to move it.
 */
export function TodoRowMenu({
  todo,
  anchorRef,
  onClose,
}: {
  todo: Todo;
  anchorRef: React.RefObject<HTMLElement>;
  onClose: () => void;
}) {
  const { updateTodo, deleteTodo, setOpenTodoId, announce } = useTodoActions();
  const today = todayISO();
  const tomorrow = toISODate(addDays(new Date(), 1));

  function move(date: string | null, label: string) {
    updateTodo(todo.id, { due_date: date });
    announce(`Moved ${todo.title} to ${label}`);
    onClose();
  }

  return (
    <AnchoredPanel
      anchorRef={anchorRef}
      onClose={onClose}
      width={190}
      estimatedHeight={232}
      label={`Options for ${todo.title}`}
      className="py-1.5"
    >
      <MenuItem onClick={() => { setOpenTodoId(todo.id); onClose(); }}>Open details</MenuItem>
      <div className="h-px bg-border-light mx-2 my-1" />
      {todo.due_date !== today && <MenuItem onClick={() => move(today, 'today')}>Move to today</MenuItem>}
      {todo.due_date !== tomorrow && (
        <MenuItem onClick={() => move(tomorrow, 'tomorrow')}>Move to tomorrow</MenuItem>
      )}
      {todo.due_date && <MenuItem onClick={() => move(null, 'Unassigned')}>Remove the date</MenuItem>}
      <div className="h-px bg-border-light mx-2 my-1" />
      <MenuItem
        danger
        onClick={() => {
          deleteTodo(todo.id);
          onClose();
        }}
      >
        Delete
      </MenuItem>
    </AnchoredPanel>
  );
}

function MenuItem({
  children,
  onClick,
  danger = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-12 transition-colors duration-120 ${
        danger
          ? 'text-danger hover:bg-danger-bg'
          : 'text-text-secondary hover:bg-bg-surface hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}
