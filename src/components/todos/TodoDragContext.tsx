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

interface DragState {
  todo: Todo;
  fromGroup: string;
  x: number;
  y: number;
  width: number;
  target: DropTarget | null;
}

interface TodoDragContextValue {
  dragging: DragState | null;
  /** Attach to a row's grip: `onPointerDown={(e) => start(e, todo, groupKey)}`. */
  start: (event: React.PointerEvent, todo: Todo, groupKey: string) => void;
  /** True while this row is the one being carried, so it can render as a ghost. */
  isDragging: (todoId: string) => boolean;
  /** The insertion line's position within `groupKey`, or null. */
  dropIndexFor: (groupKey: string) => number | null;
  /** Keyboard reordering — Ctrl/Cmd + ↑/↓ on a focused row. */
  moveByKeyboard: (todo: Todo, groupKey: string, direction: -1 | 1) => void;
}

const TodoDragContext = createContext<TodoDragContextValue | null>(null);

export function useTodoDrag(): TodoDragContextValue {
  const ctx = useContext(TodoDragContext);
  if (!ctx) throw new Error('useTodoDrag must be used inside a TodoDragProvider');
  return ctx;
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

export function TodoDragProvider({ children }: { children: React.ReactNode }) {
  const { groups, reorder, updateTodo, announce } = useTodos();
  const [dragging, setDragging] = useState<DragState | null>(null);

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
  } | null>(null);

  const draggingRef = useRef<DragState | null>(null);
  draggingRef.current = dragging;

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
   * show the row on its new day at its old position.
   */
  const commit = useCallback(
    (todo: Todo, fromGroup: string, target: DropTarget) => {
      const sameGroup = target.groupKey === fromGroup;
      const siblings = rowsOf(target.groupKey).filter((t) => t.id !== todo.id);

      const index = Math.min(Math.max(target.index, 0), siblings.length);
      const before = index > 0 ? siblings[index - 1].position : null;
      const after = index < siblings.length ? siblings[index].position : null;

      // 'overdue' is a presentation bucket, not a date — dropping into it would
      // have no date to write, so it is not a target for a move that changes
      // groups. Reordering inside it is fine.
      if (target.groupKey === 'overdue' && !sameGroup) return;

      const nextDate =
        target.groupKey === 'overdue' ? todo.due_date : target.groupKey === '' ? null : target.groupKey;

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
    setDragging(null);
    document.body.style.userSelect = '';
    document.body.style.touchAction = '';
  }, []);

  const start = useCallback(
    (event: React.PointerEvent, todo: Todo, groupKey: string) => {
      // Secondary buttons open context menus; they must not start a drag.
      if (event.button !== 0 && event.pointerType === 'mouse') return;

      const row = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-drop-index]');
      const width = row?.getBoundingClientRect().width ?? 320;
      const isTouch = event.pointerType !== 'mouse';

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
      };

      const lift = () => {
        if (!gesture.current) return;
        gesture.current.active = true;
        // Stops the page scrolling and text selecting under the finger once
        // the row is genuinely lifted — not before, or the list is unscrollable.
        document.body.style.userSelect = 'none';
        document.body.style.touchAction = 'none';
        if (isTouch && 'vibrate' in navigator) navigator.vibrate?.(8);
        setDragging({
          todo,
          fromGroup: groupKey,
          x: gesture.current.startX,
          y: gesture.current.startY,
          width,
          target: null,
        });
      };

      if (isTouch) {
        // A finger resting on the grip is a drag; a finger that moves first is
        // a scroll. The timer is cleared by the move handler below.
        gesture.current.longPressTimer = window.setTimeout(lift, LONG_PRESS_MS);
      }
      // A mouse lifts on the first few pixels of movement instead, so a plain
      // click on the grip does nothing at all.
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    function onMove(event: PointerEvent) {
      const g = gesture.current;
      if (!g || event.pointerId !== g.pointerId) return;

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
        g.active = true;
        document.body.style.userSelect = 'none';
        setDragging({
          todo: g.todo,
          fromGroup: g.fromGroup,
          x: event.clientX,
          y: event.clientY,
          width: g.width,
          target: null,
        });
        return;
      }

      event.preventDefault();
      const target = hitTest(event.clientX, event.clientY);
      setDragging((current) =>
        current ? { ...current, x: event.clientX, y: event.clientY, target } : current
      );
    }

    function onUp(event: PointerEvent) {
      const g = gesture.current;
      if (!g || event.pointerId !== g.pointerId) return;
      const state = draggingRef.current;
      const wasActive = g.active;
      const target = state?.target ?? null;
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
  }, [cancel, commit]);

  /*
   * Auto-scroll while a drag is held near the top or bottom of the viewport.
   * This is what makes a cross-week or cross-month drop reachable at all — the
   * target group is usually off-screen when the drag starts.
   */
  useEffect(() => {
    if (!dragging) return;
    let frame = 0;
    function step() {
      const state = draggingRef.current;
      if (state) {
        const fromTop = state.y;
        const fromBottom = window.innerHeight - state.y;
        let delta = 0;
        if (fromTop < AUTOSCROLL_EDGE_PX) {
          delta = -AUTOSCROLL_MAX_PX * (1 - fromTop / AUTOSCROLL_EDGE_PX);
        } else if (fromBottom < AUTOSCROLL_EDGE_PX) {
          delta = AUTOSCROLL_MAX_PX * (1 - fromBottom / AUTOSCROLL_EDGE_PX);
        }
        if (delta) window.scrollBy(0, delta);
      }
      frame = window.requestAnimationFrame(step);
    }
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [dragging]);

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

  const value = useMemo<TodoDragContextValue>(
    () => ({
      dragging,
      start,
      isDragging: (todoId: string) => dragging?.todo.id === todoId,
      dropIndexFor: (groupKey: string) =>
        dragging?.target?.groupKey === groupKey ? dragging.target.index : null,
      moveByKeyboard,
    }),
    [dragging, moveByKeyboard, start]
  );

  return (
    <TodoDragContext.Provider value={value}>
      {children}
      <DragGhost state={dragging} />
    </TodoDragContext.Provider>
  );
}

/**
 * The card that follows the pointer.
 *
 * Rendered in a portal at the document root so no ancestor's `overflow` can
 * clip it mid-drag, and `pointer-events: none` so the hit test below it reads
 * the list rather than the ghost.
 */
function DragGhost({ state }: { state: DragState | null }) {
  if (!state || typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="fixed z-[200] pointer-events-none bg-bg-base border-[1.5px] border-accent-blue rounded-card px-4 py-3 text-13.5 text-text-primary truncate"
      style={{
        left: state.x,
        top: state.y,
        width: Math.min(state.width, 420),
        // Held slightly up and left of the finger so the row is not hidden
        // underneath it, and tilted so it reads as lifted off the page.
        transform: 'translate(-24px, -50%) rotate(-1deg)',
        boxShadow: 'var(--shadow-card-hover)',
      }}
    >
      {state.todo.title}
    </div>,
    document.body
  );
}

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
