'use client';

import { memo, useRef, useState } from 'react';
import { formatTime, isOverdue, isParentLocked, subtaskProgress, todayISO } from '@/lib/todos';
import type { Todo } from '@/types';
import { TodoCheckbox } from './TodoCheckbox';
import {
  AttachmentChips,
  EstimateChip,
  OverdueChip,
  ReminderChip,
  RepeatChip,
  SpaceChip,
  SubtaskProgress,
  TimeChip,
} from './TodoChips';
import { GripIcon, OverflowIcon, PlusIcon } from './icons';
import { useTodoActions } from './TodoProvider';
import { useTodoDragActions } from './TodoDragContext';
import { TodoRowMenu } from './TodoRowMenu';

interface TodoRowProps {
  todo: Todo;
  /** The drop group this row belongs to: an ISO date, '' or 'overdue'. */
  groupKey: string;
  index: number;
  /** Compact rows drop the description and shadow — used by the All view's groups. */
  compact?: boolean;
  /** Passed down rather than read from context: the group already knows which
   *  row is being carried, and reading it here would subscribe every row on
   *  the page to every drag. */
  dragged?: boolean;
}

/**
 * The single most repeated element in the feature.
 *
 * Two shapes in one component rather than two components: an open row and a
 * completed one differ only in surface, checkbox tone and what the trailing
 * slot holds, and splitting them meant every chip change had to be made twice.
 *
 * Memoised, and deliberately reading only the identity-stable halves of the
 * two contexts. A list of forty rows re-rendering on every keystroke in quick
 * add — or on every frame of a drag — was the bulk of what made this page feel
 * slow; with this in place a change to one to-do re-renders one row.
 */
function TodoRowInner({ todo, groupKey, index, compact = false, dragged = false }: TodoRowProps) {
  const { toggleComplete, updateTodo, createTodo, setOpenTodoId, prefs } = useTodoActions();
  const { start, moveByKeyboard } = useTodoDragActions();
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const today = todayISO();
  const overdue = isOverdue(todo, new Date());
  const progress = subtaskProgress(todo);
  const locked = isParentLocked(todo);
  const hasSubtasks = (todo.subtasks?.length ?? 0) > 0;
  const time = formatTime(todo.due_time);

  // The design bolds a title only when the to-do has weight behind it — a time
  // or sub-tasks. Everything else stays regular so the bold actually means
  // something in a list of twelve.
  const emphasised = hasSubtasks || !!time;

  async function handleAddSubtask() {
    const title = subtaskDraft.trim();
    if (!title) {
      setAddingSubtask(false);
      return;
    }
    await createTodo({ title, parent_id: todo.id });
    setSubtaskDraft('');
    // Stays open: adding one sub-task almost always means adding two.
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveByKeyboard(todo, groupKey, -1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveByKeyboard(todo, groupKey, 1);
    }
  }

  if (todo.is_completed) {
    return (
      <div
        data-drop-index={index}
        data-todo-id={todo.id}
        className="flex items-center gap-3 bg-bg-surface border border-border-light rounded-card px-4 py-3"
      >
        {/* Keeps the checkbox in the same column as the open rows above, which
            have a grip in front of theirs. */}
        <span className="w-[26px] flex-shrink-0" aria-hidden="true" />
        <TodoCheckbox
          checked
          tone="green"
          onChange={() => toggleComplete(todo.id)}
          label={`Reopen ${todo.title}`}
        />
        <button
          type="button"
          onClick={() => setOpenTodoId(todo.id)}
          className="flex-1 min-w-0 text-left text-13 text-text-muted line-through truncate"
        >
          {todo.title}
        </button>
        {todo.completed_at && (
          <span className="text-11 text-text-faint flex-shrink-0 tabular-nums">
            {new Date(todo.completed_at).toLocaleTimeString('en-GB', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      data-drop-index={index}
      data-todo-id={todo.id}
      onKeyDown={handleKeyDown}
      className={`group bg-bg-base border rounded-card transition-shadow duration-120 select-none ${
        compact ? 'border-border-default' : 'border-border-default shadow-card'
      } ${dragged ? 'opacity-40 border-dashed' : ''}`}
    >
      <div className={`flex gap-3 px-4 ${todo.description ? 'items-start py-3.5' : 'items-center py-3'}`}>
        {/*
          The grip is the drag handle, not the whole row: a row that drags from
          anywhere cannot be scrolled past on a phone, and cannot hold a link.
          Hidden until hover on pointer devices, always present on touch where
          there is no hover to reveal it.
        */}
        <button
          type="button"
          onPointerDown={(e) => start(e, todo, groupKey)}
          aria-label={`Reorder ${todo.title}`}
          title="Drag to reorder — or Ctrl + ↑ / ↓"
          className="flex-shrink-0 text-border-medium opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition-opacity duration-120 cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ marginTop: todo.description ? 2 : 0 }}
        >
          <GripIcon size={14} />
        </button>

        <TodoCheckbox
          checked={false}
          onChange={() => toggleComplete(todo.id)}
          label={`Mark ${todo.title} done`}
          disabled={locked}
          disabledReason="Finish the sub-tasks first — this to-do is set to Dependent"
        />

        <div className="flex-1 min-w-0 flex flex-col gap-[4px]">
          {/* Title row — time/overdue/repeat chips stay inline with the title */}
          <div className="flex items-center gap-[7px] flex-wrap">
            <button
              type="button"
              onClick={() => setOpenTodoId(todo.id)}
              className="text-13.5 text-text-primary text-left hover:underline decoration-border-medium underline-offset-2 select-none"
              style={{ fontWeight: emphasised ? 580 : 400, letterSpacing: '-0.005em' }}
            >
              {todo.title}
            </button>

            {overdue && todo.due_date && <OverdueChip dueDate={todo.due_date} today={today} />}
            {time && !overdue && <TimeChip time={todo.due_time!} />}
            {prefs.showEstimates && todo.estimate_minutes && (
              <EstimateChip minutes={todo.estimate_minutes} />
            )}
            {todo.recurrence && <RepeatChip recurrence={todo.recurrence} />}
            {todo.reminder && <ReminderChip lead={todo.reminder.lead} />}
          </div>

          {/* Meta row — space chip + description + attachments below the title */}
          {(todo.space || (todo.description && !compact) || ((todo.attachments?.length || progress) && !compact)) && (
            <div className="flex flex-col gap-[3px]">
              {todo.space && (
                <div className="flex items-center gap-[5px]">
                  <SpaceChip color={todo.space.color} name={todo.space.name} />
                </div>
              )}
              {todo.description && !compact && (
                <p className="m-0 text-12 text-text-muted leading-[1.5]">{todo.description}</p>
              )}
              {(todo.attachments?.length || progress) && !compact ? (
                <div className="flex items-center gap-[7px] flex-wrap">
                  <AttachmentChips todo={todo} />
                  {progress && (
                    <span className="ml-1">
                      <SubtaskProgress done={progress.done} total={progress.total} />
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-start gap-2 flex-shrink-0 text-text-faint" style={{ marginTop: 2 }}>
          {overdue && (
            <button
              type="button"
              onClick={() => updateTodo(todo.id, { due_date: today })}
              className="text-11.5 text-accent-blue-dark border border-border-medium rounded-btn px-2.5 py-1.5 font-medium hover:bg-accent-blue-bg transition-colors duration-120 whitespace-nowrap"
            >
              Move to today
            </button>
          )}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={`Options for ${todo.title}`}
            aria-expanded={menuOpen}
            className="hover:text-text-secondary transition-colors duration-120"
          >
            <OverflowIcon size={14} />
          </button>
        </div>
      </div>

      {(hasSubtasks || addingSubtask) && !compact && (
        <div
          className="border-t border-border-light flex flex-col gap-[9px]"
          // 62px left padding aligns sub-rows under the parent's title rather
          // than under its checkbox.
          style={{ padding: '10px 16px 14px 62px' }}
        >
          {(todo.subtasks || []).map((subtask) => (
            <SubtaskRow key={subtask.id} subtask={subtask} />
          ))}

          {addingSubtask ? (
            <input
              autoFocus
              value={subtaskDraft}
              onChange={(e) => setSubtaskDraft(e.target.value)}
              onBlur={handleAddSubtask}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubtask();
                }
                if (e.key === 'Escape') {
                  setSubtaskDraft('');
                  setAddingSubtask(false);
                }
              }}
              placeholder="Sub-task…"
              className="w-full bg-transparent border-none outline-none text-12.5 text-text-primary placeholder:text-text-faint"
            />
          ) : (
            <button
              type="button"
              onClick={() => setAddingSubtask(true)}
              className="self-start flex items-center gap-1.5 text-12 text-text-faint hover:text-text-secondary transition-colors duration-120"
            >
              <PlusIcon size={11} /> sub-task
            </button>
          )}
        </div>
      )}

      {menuOpen && (
        <TodoRowMenu todo={todo} anchorRef={menuButtonRef} onClose={() => setMenuOpen(false)} />
      )}
    </div>
  );
}

export const TodoRow = memo(TodoRowInner);

/** A sub-task: same row, one size down, no chips of its own beyond an estimate. */
function SubtaskRow({ subtask }: { subtask: Todo }) {
  const { toggleComplete, prefs } = useTodoActions();

  return (
    <div className="flex items-center gap-[11px]">
      <TodoCheckbox
        checked={subtask.is_completed}
        onChange={() => toggleComplete(subtask.id)}
        label={
          subtask.is_completed ? `Reopen ${subtask.title}` : `Mark ${subtask.title} done`
        }
        size={16}
        radius={4}
      />
      <span
        className={`text-12.5 ${
          subtask.is_completed ? 'text-text-muted line-through' : 'text-text-primary'
        }`}
      >
        {subtask.title}
      </span>
      {prefs.showEstimates && subtask.estimate_minutes && !subtask.is_completed && (
        <span className="font-mono text-[9.5px] text-text-faint border border-border-default rounded px-[5px] py-px">
          {subtask.estimate_minutes}m
        </span>
      )}
    </div>
  );
}
