'use client';

import { Fragment, memo, useState } from 'react';
import { useSpaces } from '@/lib/spaces';
import type { Todo } from '@/types';
import { QuickAdd } from './QuickAdd';
import { TodoCheckbox } from './TodoCheckbox';
import { DropIndicator, useTodoDrag, useTodoDragActions } from './TodoDragContext';
import { GripIcon } from './icons';
import { useTodoActions } from './TodoProvider';

/** Rows past this fold behind a "+N more" until asked. */
const VISIBLE = 8;

/**
 * Anytime — the All view's right-hand column.
 *
 * "Anytime" rather than "Unassigned". Unassigned describes a missing field;
 * what this list actually holds is work that is real and wanted but not owed to
 * a particular day — the things you do when a gap appears. Naming it after the
 * absence made it read as an inbox of half-finished data entry, which is
 * exactly the wrong feeling for the list you are meant to browse when you have
 * a spare twenty minutes.
 *
 * It takes 40% of the page rather than a 300px rail, because in All it is not a
 * margin note: it is the other half of the answer to "what could I be doing".
 *
 * It is also a drop target — dragging a row here clears its date.
 */
export function AnytimeColumn({ todos }: { todos: Todo[] }) {
  const { spaces } = useSpaces();
  const { dropIndexFor, draggingId } = useTodoDrag();
  const [expanded, setExpanded] = useState(false);
  const [spaceFilter, setSpaceFilter] = useState<string | null>(null);

  const dropIndex = dropIndexFor('');
  const filtered = spaceFilter ? todos.filter((t) => t.space_id === spaceFilter) : todos;
  const visible = expanded ? filtered : filtered.slice(0, VISIBLE);
  const hidden = filtered.length - visible.length;

  return (
    <aside className="w-full border-l border-border-default bg-bg-surface px-6 py-[26px] flex flex-col gap-3 self-start sticky top-[52px] max-h-[calc(100vh-52px)] overflow-y-auto overscroll-none">
      <div className="flex items-center gap-2">
        <h2 className="m-0 font-serif text-[19px] font-normal text-[color:var(--heading-color)]" style={{ letterSpacing: '-0.015em' }}>
          Anytime
        </h2>
        <span className="text-10 font-semibold bg-accent-green text-accent-green-dark rounded-full px-[7px] py-[2px]">
          {todos.length}
        </span>
      </div>

      <p className="m-0 text-12 text-text-muted leading-[1.55]">
        Things worth doing that no day is waiting on. Drag one onto a date when it becomes this
        week&rsquo;s problem.
      </p>

      <QuickAdd
        variant="inline"
        dueDate={null}
        spaceId={spaceFilter}
        placeholder="Add without a date"
      />

      {spaces.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <SpaceChipButton active={!spaceFilter} onClick={() => setSpaceFilter(null)} label="All" />
          {spaces.map((space) => (
            <SpaceChipButton
              key={space.id}
              active={spaceFilter === space.id}
              onClick={() => setSpaceFilter(spaceFilter === space.id ? null : space.id)}
              label={space.name}
            />
          ))}
        </div>
      )}

      <div data-drop-group="" className="flex flex-col gap-[7px] mt-0.5">
        {visible.map((todo, index) => (
          <Fragment key={todo.id}>
            {dropIndex === index && <DropIndicator />}
            <AnytimeRow todo={todo} index={index} dragged={draggingId === todo.id} />
          </Fragment>
        ))}
        {dropIndex !== null && dropIndex >= visible.length && <DropIndicator />}

        {filtered.length === 0 && (
          <p className="m-0 text-11.5 text-text-faint py-2">
            {spaceFilter ? 'Nothing here in this space.' : 'Nothing waiting. Rare and good.'}
          </p>
        )}
      </div>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-11.5 text-text-muted hover:text-text-secondary transition-colors duration-120"
        >
          +{hidden} more
        </button>
      )}
    </aside>
  );
}

/** A narrower row than TodoRow — this column has no room for the chip rail. */
const AnytimeRow = memo(function AnytimeRow({
  todo,
  index,
  dragged,
}: {
  todo: Todo;
  index: number;
  dragged: boolean;
}) {
  const { toggleComplete, setOpenTodoId } = useTodoActions();
  const { start } = useTodoDragActions();

  return (
    <div
      data-drop-index={index}
      data-todo-id={todo.id}
      className={`group flex items-center gap-[9px] bg-bg-base border border-border-default rounded-widget px-3 py-2.5 ${
        dragged ? 'opacity-40 border-dashed' : ''
      }`}
    >
      <button
        type="button"
        onPointerDown={(e) => start(e, todo, '')}
        aria-label={`Reorder ${todo.title}`}
        className="flex-shrink-0 text-border-medium opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-120 cursor-grab active:cursor-grabbing touch-none"
      >
        <GripIcon size={13} />
      </button>
      <TodoCheckbox
        checked={todo.is_completed}
        onChange={() => toggleComplete(todo.id)}
        label={`Mark ${todo.title} done`}
        size={16}
        radius={4}
      />
      <button
        type="button"
        onClick={() => setOpenTodoId(todo.id)}
        className="flex-1 min-w-0 text-left text-12.5 text-text-primary truncate"
      >
        {todo.title}
      </button>
      {todo.space && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: todo.space.color }}
          title={todo.space.name}
        />
      )}
    </div>
  );
});

function SpaceChipButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-10.5 rounded-full px-2.5 py-1 transition-colors duration-120 ${
        active
          ? 'bg-accent-blue-bg text-accent-blue-dark font-medium'
          : 'text-text-secondary bg-bg-base border border-border-default hover:border-border-medium'
      }`}
    >
      {label}
    </button>
  );
}
