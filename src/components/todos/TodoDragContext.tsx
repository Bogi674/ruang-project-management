'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { POSITION_STEP, needsRebalance, positionBetween, rebalance } from '@/lib/todos';
import type { Todo } from '@/types';
import { useTodos } from './TodoProvider';

/**
 * Drag-and-drop for to-do rows.
 *
 * Built on Pointer Events rather than the HTML5 drag-and-drop API that
 * `lib/dnd.ts` uses for notes. That is a deliberate divergence: HTML5 DnD does
 * not fire on touch at all, and reordering across dates is the second thing
 * this feature was asked for — on a phone as much as on a desktop. Pointer
 * Events give mouse, pen and touch from one code path, plus the long-press
 * threshold that stops a drag from starting every time a list is scrolled.
 *
 * Drop targets are found by hit-testing the DOM rather than by registering
 * callbacks: a group marks itself with `data-drop-group`, each row inside it
 * with `data-drop-index`, and the controller reads those on every move. Groups
 * therefore work anywhere — the list, the calendar cells, the Unassigned
 * column — without wiring anything through React.
 *
 * ── What makes it fast ──
 *
 * Nothing that changes at pointer speed goes through React. The card that
 * follows the cursor is positioned by writing `transform` onto its own node,
 * and the hit test runs once per animation frame rather than once per
 * `pointermove` event. React state is updated only when the *drop target*
 * changes — roughly once per row crossed instead of sixty times a second —
 * which is what took a drag from single-figure FPS to smooth on a list of any
 * length.
 */

/** Hold this long before a touch turns into a drag rather than a scroll. */
const LONG_PRESS_MS = 350;
/** A mouse drag starts as soon as the pointer has moved this far from the grip. */
const MOUSE_THRESHOLD_PX = 4;
/** How close to the viewport edge before the page starts scrolling itself. */
const AUTOSCROLL_EDGE_PX = 72;
const AUTOSCROLL_MAX_PX = 18;

export interface DropTarget {
  /** ISO date, '' for unassigned, or a caller-defined key like 'overdue'. */
  groupKey: string;
  /** Insertion index within the group. */
  index: number;
}

/** The only thing rows subscribe to. Changes when a row is lifted or dropped,
 *  and when the insertion point moves — never on plain pointer movement. */
interface DragState {
  todoId: string;
  fromGroup: string;
  target: DropTarget | null;
}

interface TodoDragActions {
  /** Attach to a row's grip: `onPointerDown={(e) => start(e, todo, groupKey)}`. */
  start: (event: React.PointerEvent, todo: Todo, groupKey: string) => void;
  /** Keyboard reordering — Ctrl/Cmd + ↑/↓ on a focused row. */
  moveByKeyboard: (todo: Todo, groupKey: string, direction: -1 | 1) => void;
}

interface TodoDragContextValue extends TodoDragActions {
  draggingId: string | null;
  /** True while this row is the one being carried, so it can render as a ghost. */
  isDragging: (todoId: string) => boolean;
  /** The insertion line's position within `groupKey`, or null. */
  dropIndexFor: (groupKey: string) => number | null;
}

const DragStateContext = createContext<DragState | null>(null);
const DragActionsContext = createContext<TodoDragActions | null>(null);

/** For containers that draw the insertion line. */
export function useTodoDrag(): TodoDragContextValue {
  const actions = useContext(DragActionsContext);
  const state = useContext(DragStateContext);
  if (!actions) throw new Error('useTodoDrag must be used inside a TodoDragProvider');
  return useMemo(
    () => ({
      ...actions,
      draggingId: state?.todoId ?? null,
      isDragging: (todoId: string) => state?.todoId === todoId,
      dropIndexFor: (groupKey: string) =>
        state?.target?.groupKey === groupKey ? state.target.index : null,
    }),
    [actions, state]
  );
}

/** Identity-stable. A row that only needs to *start* a drag uses this and is
 *  never re-rendered by anyone else's drag. */
export function useTodoDragActions(): TodoDragActions {
  const actions = useContext(DragActionsContext);
  if (!actions) throw new Error('useTodoDragActions must be used inside a TodoDragProvider');
  return actions;
}

/**
 * Which group the pointer is over, and where in it the row would land.
 *
 * `elementFromPoint` rather than pointer enter/leave on every row: the dragged
 * card follows the cursor and would otherwise be the element under it. The
 * ghost is `pointer-events: none` for exactly this reason.
 */
function hitTest(x: number, y: number): DropTarget | null {
  const element = document.elementFromPoint(x, y);
  const container = element?.closest<HTMLElement>('[data-drop-group]');
  if (!container) return null;

  const groupKey = container.dataset.dropGroup ?? '';
  const rows = Array.from(container.querySelectorAll<HTMLElement>('[data-drop-index]'));

  // Above every row's midpoint means "insert before it"; past the last one
  // means append. An empty group always takes index 0.
  let index = rows.length;
  for (let i = 0; i < rows.length; i++) {
    const rect = rows[i].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) {
      index = i;
      break;
    }
  }
  return { groupKey, index };
}

function sameTarget(a: DropTarget | null, b: DropTarget | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.groupKey === b.groupKey && a.index === b.index;
}

export function TodoDragProvider({ children }: { children: React.ReactNode }) {
  const { groups, reorder, announce } = useTodos();
  const [dragState, setDragState] = useState<DragState | null>(null);

  // The gesture's mutable bookkeeping. Kept in a ref because pointermove fires
  // on every frame and re-rendering the whole list that often would drop the
  // drag to single figures of FPS.
  const gesture = useRef<{
    todo: Todo;
    fromGroup: string;
    startX: number;
    startY: number;
    width: number;
    pointerId: number;
    active: boolean;
    longPressTimer: number | null;
    isTouch: boolean;
    target: DropTarget | null;
  } | null>(null);

  /** Latest pointer position, read by the animation frame rather than by React. */
  const pointer = useRef({ x: 0, y: 0 });
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);

  const groupsRef = useRef(groups);
  groupsRef.current = groups;

  /** The open rows of a group, in the order they render. */
  const rowsOf = useCallback((groupKey: string): Todo[] => {
    const current = groupsRef.current;
    if (groupKey === 'overdue') return current.overdue;
    if (groupKey === '') return current.unassigned;
    return current.dated[groupKey] || [];
  }, []);

  /**
   * Writes the move.
   *
   * The row's new neighbours decide its position; its new group decides its
   * date. Both travel in one PATCH so a reload cannot land between them and
   * show the row on its new day at its old position. `reorder` applies the
   * change to local state before it sends anything, so the row lands where it
   * was dropped on the same frame the finger lifts.
   */
  const commit = useCallback(
    (todo: Todo, fromGroup: string, target: DropTarget) => {
      const sameGroup = target.groupKey === fromGroup;

      // 'overdue' is a presentation bucket, not a date — dropping into it would
      // have no date to write, so it is not a target for a move that changes
      // groups. Reordering inside it is fine.
      if (target.groupKey === 'overdue' && !sameGroup) return;

      /*
       * A drop back into the slot it came from is not a move. `target.index`
       * counts positions in the group *including* the dragged row, so both the
       * index it occupies and the one immediately after it mean "leave it
       * alone" — without this, picking a row up and putting it down writes a
       * pointless UPDATE and flashes the list.
       */
      const currentIndex = sameGroup ? rowsOf(fromGroup).findIndex((t) => t.id === todo.id) : -1;
      if (currentIndex !== -1 && (target.index === currentIndex || target.index === currentIndex + 1)) {
        return;
      }

      const siblings = rowsOf(target.groupKey).filter((t) => t.id !== todo.id);
      // Within its own group the reported index counts the dragged row itself,
      // so everything below it is off by one once the row is taken out.
      const wanted = currentIndex !== -1 && target.index > currentIndex ? target.index - 1 : target.index;
      const index = Math.min(Math.max(wanted, 0), siblings.length);
      const before = index > 0 ? siblings[index - 1].position : null;
      const after = index < siblings.length ? siblings[index].position : null;

      const nextDate =
        target.groupKey === 'overdue'
          ? todo.due_date
          : target.groupKey === ''
          ? null
          : target.groupKey;

      /*
       * Midpoints eventually run out of float precision. When they do, the
       * whole group is renumbered onto clean multiples of POSITION_STEP in the
       * same request — the alternative is two rows sharing a position and the
       * order quietly becoming arbitrary.
       */
      if (needsRebalance(before, after)) {
        const reordered = [...siblings];
        reordered.splice(index, 0, { ...todo, due_date: nextDate });
        const entries = rebalance(reordered).map((entry) =>
          entry.id === todo.id ? { ...entry, due_date: nextDate } : entry
        );
        reorder(entries);
      } else {
        const position = positionBetween(before, after);
        reorder([{ id: todo.id, position, due_date: nextDate }]);
      }

      if (!sameGroup) {
        announce(
          nextDate
            ? `Moved ${todo.title} to ${new Date(`${nextDate}T00:00:00`).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
              })}`
            : `Moved ${todo.title} to Unassigned`
        );
      } else {
        announce(`Moved ${todo.title} to position ${index + 1}`);
      }
    },
    [announce, reorder, rowsOf]
  );

  /* ── The gesture ───────────────────────────────────────────────────────── */

  const cancel = useCallback(() => {
    if (gesture.current?.longPressTimer) window.clearTimeout(gesture.current.longPressTimer);
    gesture.current = null;
    if (frame.current) {
      window.cancelAnimationFrame(frame.current);
      frame.current = 0;
    }
    setDragState(null);
    document.body.style.userSelect = '';
    document.body.style.touchAction = '';
  }, []);

  /**
   * One animation frame: move the ghost, re-hit-test, auto-scroll.
   *
   * All three used to be driven by `pointermove` and React state. Doing them
   * here caps the work at one pass per painted frame no matter how fast the
   * pointer reports, and only the hit-test *result* is allowed to reach React.
   */
  const tick = useCallback(() => {
    const g = gesture.current;
    if (!g?.active) {
      frame.current = 0;
      return;
    }
    const { x, y } = pointer.current;

    if (ghostRef.current) {
      // Held slightly up and left of the finger so the row is not hidden
      // underneath it, and tilted so it reads as lifted off the page.
      ghostRef.current.style.transform = `translate3d(${x - 24}px, ${y}px, 0) translateY(-50%) rotate(-1deg)`;
    }

    const target = hitTest(x, y);
    if (!sameTarget(target, g.target)) {
      g.target = target;
      setDragState((current) => (current ? { ...current, target } : current));
    }

    const fromTop = y;
    const fromBottom = window.innerHeight - y;
    let delta = 0;
    if (fromTop < AUTOSCROLL_EDGE_PX) {
      delta = -AUTOSCROLL_MAX_PX * (1 - fromTop / AUTOSCROLL_EDGE_PX);
    } else if (fromBottom < AUTOSCROLL_EDGE_PX) {
      delta = AUTOSCROLL_MAX_PX * (1 - fromBottom / AUTOSCROLL_EDGE_PX);
    }
    if (delta) window.scrollBy(0, delta);

    frame.current = window.requestAnimationFrame(tick);
  }, []);

  const lift = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    g.active = true;
    // Stops the page scrolling and text selecting under the finger once the
    // row is genuinely lifted — not before, or the list is unscrollable.
    document.body.style.userSelect = 'none';
    document.body.style.touchAction = 'none';
    if (g.isTouch && 'vibrate' in navigator) navigator.vibrate?.(8);
    setDragState({ todoId: g.todo.id, fromGroup: g.fromGroup, target: null });
    if (!frame.current) frame.current = window.requestAnimationFrame(tick);
  }, [tick]);

  const start = useCallback(
    (event: React.PointerEvent, todo: Todo, groupKey: string) => {
      // Secondary buttons open context menus; they must not start a drag.
      if (event.button !== 0 && event.pointerType === 'mouse') return;

      const row = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-drop-index]');
      const width = row?.getBoundingClientRect().width ?? 320;
      const isTouch = event.pointerType !== 'mouse';

      pointer.current = { x: event.clientX, y: event.clientY };
      gesture.current = {
        todo,
        fromGroup: groupKey,
        startX: event.clientX,
        startY: event.clientY,
        width,
        pointerId: event.pointerId,
        active: false,
        longPressTimer: null,
        isTouch,
        target: null,
      };

      if (isTouch) {
        // A finger resting on the grip is a drag; a finger that moves first is
        // a scroll. The timer is cleared by the move handler below.
        gesture.current.longPressTimer = window.setTimeout(lift, LONG_PRESS_MS);
      }
      // A mouse lifts on the first few pixels of movement instead, so a plain
      // click on the grip does nothing at all.
    },
    [lift]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function onMove(event: PointerEvent) {
      const g = gesture.current;
      if (!g || event.pointerId !== g.pointerId) return;
      pointer.current = { x: event.clientX, y: event.clientY };

      if (!g.active) {
        const moved = Math.hypot(event.clientX - g.startX, event.clientY - g.startY);
        if (g.isTouch) {
          // Moved before the long press fired: this was a scroll.
          if (moved > 10 && g.longPressTimer) {
            window.clearTimeout(g.longPressTimer);
            gesture.current = null;
          }
          return;
        }
        if (moved < MOUSE_THRESHOLD_PX) return;
        lift();
        return;
      }

      // Everything else happens in the animation frame; this handler exists
      // only to record where the pointer is.
      event.preventDefault();
    }

    function onUp(event: PointerEvent) {
      const g = gesture.current;
      if (!g || event.pointerId !== g.pointerId) return;
      const wasActive = g.active;
      const target = g.target;
      const todo = g.todo;
      const fromGroup = g.fromGroup;
      cancel();
      if (wasActive && target) commit(todo, fromGroup, target);
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && gesture.current?.active) cancel();
    }

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('keydown', onKey);
    };
  }, [cancel, commit, lift]);

  useEffect(() => () => {
    if (frame.current) window.cancelAnimationFrame(frame.current);
  }, []);

  /* ── Keyboard ──────────────────────────────────────────────────────────── */

  /**
   * Ctrl/Cmd + ↑/↓ moves a row within its group.
   *
   * The pointer path above is unreachable by keyboard, and reordering is not a
   * decoration — without this the feature is simply unavailable to anyone not
   * using a pointer.
   */
  const moveByKeyboard = useCallback(
    (todo: Todo, groupKey: string, direction: -1 | 1) => {
      const siblings = rowsOf(groupKey);
      const from = siblings.findIndex((t) => t.id === todo.id);
      if (from === -1) return;
      const to = from + direction;
      if (to < 0 || to >= siblings.length) return;

      // splice-based index, so moving down lands *after* the row it passed.
      const without = siblings.filter((t) => t.id !== todo.id);
      const before = to > 0 ? without[to - 1]?.position ?? null : null;
      const after = without[to]?.position ?? null;

      if (needsRebalance(before, after)) {
        const reordered = [...without];
        reordered.splice(to, 0, todo);
        reorder(rebalance(reordered));
      } else {
        reorder([{ id: todo.id, position: positionBetween(before, after) }]);
      }
      announce(`Moved ${todo.title} to position ${to + 1} of ${siblings.length}`);
    },
    [announce, reorder, rowsOf]
  );

  const actions = useMemo<TodoDragActions>(
    () => ({ start, moveByKeyboard }),
    [moveByKeyboard, start]
  );

  return (
    <DragActionsContext.Provider value={actions}>
      <DragStateContext.Provider value={dragState}>
        {children}
        {dragState && (
          <DragGhost
            ref={ghostRef}
            title={gesture.current?.todo.title ?? ''}
            width={gesture.current?.width ?? 320}
            x={pointer.current.x}
            y={pointer.current.y}
          />
        )}
      </DragStateContext.Provider>
    </DragActionsContext.Provider>
  );
}

/**
 * The card that follows the pointer.
 *
 * Rendered in a portal at the document root so no ancestor's `overflow` can
 * clip it mid-drag, and `pointer-events: none` so the hit test below it reads
 * the list rather than the ghost. It is mounted once per drag and then moved
 * by writing `transform` on the node — React never sees the coordinates.
 */
const DragGhost = React.forwardRef<
  HTMLDivElement,
  { title: string; width: number; x: number; y: number }
>(function DragGhost({ title, width, x, y }, ref) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={ref}
      aria-hidden="true"
      className="fixed left-0 top-0 z-[200] pointer-events-none bg-bg-base border-[1.5px] border-accent-blue rounded-card px-4 py-3 text-13.5 text-text-primary truncate will-change-transform"
      style={{
        width: Math.min(width, 420),
        transform: `translate3d(${x - 24}px, ${y}px, 0) translateY(-50%) rotate(-1deg)`,
        boxShadow: 'var(--shadow-card-hover)',
      }}
    >
      {title}
    </div>,
    document.body
  );
});

/** The 3px accent line drawn where the row would land. */
export function DropIndicator() {
  return (
    <div
      aria-hidden="true"
      className="h-[3px] -my-[1.5px] rounded-full bg-accent-blue"
      style={{ boxShadow: '0 0 0 3px var(--accent-wash-soft)' }}
    />
  );
}

export { POSITION_STEP };
