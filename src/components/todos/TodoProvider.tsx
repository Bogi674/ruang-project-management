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
import { emitTodosChanged } from '@/lib/dnd';
import { usePreferences } from '@/lib/preferences';
import {
  resolveTodoPreferences,
  sortByPosition,
  todayISO,
  type ResolvedTodoPreferences,
} from '@/lib/todos';
import type { Todo, TodoAttachment, TodoFilter, TodoGroups, TodoView } from '@/types';

const FILTER_KEY = 'ruang_todo_filter';
const VIEW_KEY = 'ruang_todo_view';
/** How long a completed row can be pulled back out of Done. */
export const UNDO_WINDOW_MS = 3000;

export interface UndoEntry {
  todoId: string;
  title: string;
  previous: Todo;
  expiresAt: number;
}

interface TodoContextValue {
  /** Flat, including sub-tasks. Grouped views read `groups` instead. */
  todos: Todo[];
  groups: TodoGroups;
  loading: boolean;
  error: string | null;
  filter: TodoFilter;
  setFilter: (next: TodoFilter) => void;
  view: TodoView;
  setView: (next: TodoView) => void;
  prefs: ResolvedTodoPreferences;
  spaceFilter: string | null;
  setSpaceFilter: (id: string | null) => void;

  createTodo: (input: Partial<Todo> & { title: string }) => Promise<Todo | null>;
  updateTodo: (id: string, patch: Partial<Todo>) => Promise<boolean>;
  toggleComplete: (id: string) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  reorder: (entries: { id: string; position: number; due_date?: string | null }[]) => Promise<void>;
  attach: (todoId: string, body: Record<string, unknown>) => Promise<TodoAttachment | null>;
  detach: (todoId: string, attachmentId: string) => Promise<void>;

  openTodoId: string | null;
  setOpenTodoId: (id: string | null) => void;
  undo: UndoEntry | null;
  runUndo: () => void;
  dismissUndo: () => void;

  refresh: () => void;
  /** Announces to the live region — "Marked done", "Moved to Wednesday 19". */
  announce: (message: string) => void;
  liveMessage: string;
}

const TodoContext = createContext<TodoContextValue | null>(null);

export function useTodos(): TodoContextValue {
  const ctx = useContext(TodoContext);
  if (!ctx) throw new Error('useTodos must be used inside a TodoProvider');
  return ctx;
}

function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(key);
  return (allowed as readonly string[]).includes(stored ?? '') ? (stored as T) : fallback;
}

/** The API returns groups; the client keeps one flat list so a mutation is a map. */
function flatten(groups: TodoGroups): Todo[] {
  const out: Todo[] = [];
  const push = (todo: Todo) => {
    const { subtasks, ...parent } = todo;
    out.push(parent as Todo);
    for (const sub of subtasks || []) out.push(sub);
  };
  groups.overdue.forEach(push);
  Object.values(groups.dated).forEach((list) => list.forEach(push));
  groups.unassigned.forEach(push);
  Object.values(groups.done).forEach((list) => list.forEach(push));
  return out;
}

const EMPTY_GROUPS: TodoGroups = {
  overdue: [],
  dated: {},
  unassigned: [],
  done: {},
  counts: { tomorrow: 0, restOfWeek: 0, total: 0, doneThisMonth: 0 },
};

export function TodoProvider({
  children,
  initialGroups,
  initialFilter,
}: {
  children: React.ReactNode;
  initialGroups?: TodoGroups | null;
  initialFilter?: TodoFilter;
}) {
  const { preferences } = usePreferences();
  const prefs = useMemo(
    () => resolveTodoPreferences(preferences as unknown as Record<string, unknown>),
    [preferences]
  );

  const [todos, setTodos] = useState<Todo[]>(() =>
    initialGroups ? flatten(initialGroups) : []
  );
  const [counts, setCounts] = useState(initialGroups?.counts ?? EMPTY_GROUPS.counts);
  const [loading, setLoading] = useState(!initialGroups);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilterState] = useState<TodoFilter>(initialFilter ?? 'today');
  const [view, setViewState] = useState<TodoView>('list');
  const [spaceFilter, setSpaceFilter] = useState<string | null>(null);
  const [openTodoId, setOpenTodoId] = useState<string | null>(null);
  const [undo, setUndo] = useState<UndoEntry | null>(null);
  const [liveMessage, setLiveMessage] = useState('');

  // Shadows `todos` so a mutation can roll back to the value that was live when
  // it started, without the callback closing over a stale render.
  const todosRef = useRef(todos);
  todosRef.current = todos;

  const announce = useCallback((message: string) => {
    // Cleared first so an identical consecutive message is still read out —
    // a screen reader ignores a live region whose text has not changed.
    setLiveMessage('');
    window.setTimeout(() => setLiveMessage(message), 30);
  }, []);

  /*
   * The filter and view are restored from localStorage in an effect rather
   * than in the useState initialiser: the server renders the default and a
   * mismatched first client render is a hydration error.
   */
  useEffect(() => {
    if (!initialFilter) {
      setFilterState(readStored<TodoFilter>(FILTER_KEY, ['today', 'week', 'month', 'all'], 'today'));
    }
    setViewState(readStored<TodoView>(VIEW_KEY, ['list', 'calendar'], 'list'));
  }, [initialFilter]);

  const setFilter = useCallback(
    (next: TodoFilter) => {
      setFilterState(next);
      try {
        window.localStorage.setItem(FILTER_KEY, next);
      } catch {
        /* private mode — the filter just does not persist */
      }
    },
    []
  );

  const setView = useCallback((next: TodoView) => {
    setViewState(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* private mode */
    }
  }, []);

  /* ── Loading ───────────────────────────────────────────────────────────── */

  // Bumped to force a reload; also used to discard a response that arrives
  // after the filter has already moved on.
  const [reloadToken, setReloadToken] = useState(0);
  const requestId = useRef(0);
  const skipNextFetch = useRef(Boolean(initialGroups));

  const refresh = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    // The server already rendered the first filter's payload.
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    const params = new URLSearchParams({ filter });
    if (spaceFilter) params.set('space', spaceFilter);

    fetch(`/api/todos?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Could not load your to-dos');
        return res.json() as Promise<TodoGroups>;
      })
      .then((groups) => {
        // A slower earlier request must not overwrite a newer one's result.
        if (id !== requestId.current) return;
        setTodos(flatten(groups));
        setCounts(groups.counts);
        setError(null);
      })
      .catch((e: Error) => {
        if (id !== requestId.current) return;
        setError(e.message);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [filter, spaceFilter, reloadToken]);

  /* ── Grouping ──────────────────────────────────────────────────────────── */

  const groups = useMemo<TodoGroups>(() => {
    const today = todayISO();
    const byParent = new Map<string, Todo[]>();
    for (const todo of todos) {
      if (!todo.parent_id) continue;
      const list = byParent.get(todo.parent_id) || [];
      list.push(todo);
      byParent.set(todo.parent_id, list);
    }

    const next: TodoGroups = {
      overdue: [],
      dated: {},
      unassigned: [],
      done: {},
      counts,
    };

    const parents = todos
      .filter((t) => !t.parent_id)
      .map((t) => ({ ...t, subtasks: sortByPosition(byParent.get(t.id) || []) }));

    for (const todo of sortByPosition(parents)) {
      if (todo.is_completed) {
        const key = todo.due_date || '';
        (next.done[key] = next.done[key] || []).push(todo);
      } else if (!todo.due_date) {
        next.unassigned.push(todo);
      } else if (todo.due_date < today) {
        next.overdue.push(todo);
      } else {
        (next.dated[todo.due_date] = next.dated[todo.due_date] || []).push(todo);
      }
    }
    return next;
  }, [todos, counts]);

  /* ── Mutations ─────────────────────────────────────────────────────────── */

  /**
   * Counts come from the server, so an optimistic completion would leave the
   * header reading "4 to go" while four rows show. Rather than recompute them
   * from a window that does not contain every to-do, the totals are nudged
   * locally and reconciled by a debounced background refetch.
   */
  const resyncTimer = useRef<number | null>(null);
  const scheduleResync = useCallback(() => {
    // Tells the sidebar badge to recount straight away; the local refetch that
    // reconciles this page's own totals can wait out the debounce.
    emitTodosChanged();
    if (resyncTimer.current) window.clearTimeout(resyncTimer.current);
    resyncTimer.current = window.setTimeout(() => refresh(), 1500);
  }, [refresh]);

  useEffect(() => () => {
    if (resyncTimer.current) window.clearTimeout(resyncTimer.current);
  }, []);

  const createTodo = useCallback(
    async (input: Partial<Todo> & { title: string }): Promise<Todo | null> => {
      try {
        const res = await fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error || 'Could not add that to-do');
          return null;
        }
        const created = (await res.json()) as Todo;
        setTodos((current) => [...current, created]);
        setCounts((c) => ({ ...c, total: c.total + 1 }));
        setError(null);
        announce(`Added ${created.title}`);
        scheduleResync();
        return created;
      } catch {
        setError('Could not reach the server — that to-do was not saved');
        return null;
      }
    },
    [announce, scheduleResync]
  );

  /** Optimistic field update. Rolls the row back on failure. */
  const updateTodo = useCallback(
    async (id: string, patch: Partial<Todo>): Promise<boolean> => {
      const previous = todosRef.current.find((t) => t.id === id);
      if (!previous) return false;

      setTodos((current) => current.map((t) => (t.id === id ? { ...t, ...patch } : t)));

      try {
        const res = await fetch(`/api/todos/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setTodos((current) => current.map((t) => (t.id === id ? previous : t)));
          setError(body?.error || 'Could not save that change');
          return false;
        }
        /*
         * The response carries the saved row plus up to two side effects the
         * server owned: a dependent parent that opened or closed, and the next
         * instance of a repeating to-do. Both are pulled off before the rest is
         * merged, so neither ends up as a stray field on the row itself.
         */
        const { parent, next_occurrence: generated, ...saved } = (await res.json()) as Todo & {
          parent?: Todo | null;
          next_occurrence?: Todo | null;
        };

        setTodos((current) => {
          const next = current.map((t) => {
            if (t.id === id) return { ...t, ...saved };
            if (parent && t.id === parent.id) return { ...t, ...parent };
            return t;
          });
          // A generated instance may fall outside the current filter's window;
          // the debounced resync drops it again if so.
          return generated && !next.some((t) => t.id === generated.id)
            ? [...next, generated]
            : next;
        });
        setError(null);
        return true;
      } catch {
        setTodos((current) => current.map((t) => (t.id === id ? previous : t)));
        setError('Could not reach the server — that change was not saved');
        return false;
      }
    },
    []
  );

  const toggleComplete = useCallback(
    async (id: string) => {
      const todo = todosRef.current.find((t) => t.id === id);
      if (!todo) return;
      const next = !todo.is_completed;

      // The undo window only exists for the direction that makes a row
      // disappear. Re-opening one puts it back in view, which is its own undo.
      if (next && prefs.doneBehavior === 'section') {
        setUndo({ todoId: id, title: todo.title, previous: todo, expiresAt: Date.now() + UNDO_WINDOW_MS });
      }

      const ok = await updateTodo(id, {
        is_completed: next,
        // Mirrors what the server stamps, so the "done at 08:10" caption is
        // right immediately rather than after the response lands.
        completed_at: next ? new Date().toISOString() : null,
      });

      if (ok) {
        setCounts((c) => ({ ...c, total: Math.max(0, c.total + (next ? -1 : 1)) }));
        announce(next ? `Marked ${todo.title} done` : `Reopened ${todo.title}`);
        scheduleResync();
      }
    },
    [announce, prefs.doneBehavior, scheduleResync, updateTodo]
  );

  const runUndo = useCallback(() => {
    if (!undo) return;
    const entry = undo;
    setUndo(null);
    updateTodo(entry.todoId, { is_completed: false, completed_at: null }).then((ok) => {
      if (ok) {
        setCounts((c) => ({ ...c, total: c.total + 1 }));
        announce(`Reopened ${entry.title}`);
      }
    });
  }, [announce, undo, updateTodo]);

  const dismissUndo = useCallback(() => setUndo(null), []);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(() => setUndo(null), Math.max(0, undo.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [undo]);

  const deleteTodo = useCallback(
    async (id: string) => {
      const previous = todosRef.current;
      const todo = previous.find((t) => t.id === id);
      // Sub-tasks cascade in the database, so they go from the list too.
      setTodos((current) => current.filter((t) => t.id !== id && t.parent_id !== id));

      try {
        const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        if (todo) announce(`Deleted ${todo.title}`);
        if (openTodoId === id) setOpenTodoId(null);
        scheduleResync();
      } catch {
        setTodos(previous);
        setError('Could not delete that to-do');
      }
    },
    [announce, openTodoId, scheduleResync]
  );

  /**
   * Persist an order change.
   *
   * The rows have already moved on screen — the caller reorders state before
   * calling this, because waiting for a round trip makes a drag feel broken.
   * A rejection reloads from the server rather than trying to reverse the
   * drag, since a partial failure leaves no single previous order to restore.
   */
  const reorder = useCallback(
    async (entries: { id: string; position: number; due_date?: string | null }[]) => {
      if (entries.length === 0) return;
      try {
        const res = await fetch('/api/todos/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entries),
        });
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { updated: number; requested: number };
        if (body.updated !== body.requested) refresh();
      } catch {
        setError('Could not save the new order');
        refresh();
      }
    },
    [refresh]
  );

  const attach = useCallback(
    async (todoId: string, body: Record<string, unknown>): Promise<TodoAttachment | null> => {
      try {
        const res = await fetch(`/api/todos/${todoId}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => null);
          setError(err?.error || 'Could not attach that');
          return null;
        }
        const created = (await res.json()) as TodoAttachment;
        setTodos((current) =>
          current.map((t) =>
            t.id === todoId ? { ...t, attachments: [...(t.attachments || []), created] } : t
          )
        );
        setError(null);
        return created;
      } catch {
        setError('Could not reach the server');
        return null;
      }
    },
    []
  );

  const detach = useCallback(async (todoId: string, attachmentId: string) => {
    const previous = todosRef.current;
    setTodos((current) =>
      current.map((t) =>
        t.id === todoId
          ? { ...t, attachments: (t.attachments || []).filter((a) => a.id !== attachmentId) }
          : t
      )
    );
    try {
      const res = await fetch(`/api/todos/attachments/${attachmentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
    } catch {
      setTodos(previous);
      setError('Could not remove that attachment');
    }
  }, []);

  const value: TodoContextValue = {
    todos,
    groups,
    loading,
    error,
    filter,
    setFilter,
    view,
    setView,
    prefs,
    spaceFilter,
    setSpaceFilter,
    createTodo,
    updateTodo,
    toggleComplete,
    deleteTodo,
    reorder,
    attach,
    detach,
    openTodoId,
    setOpenTodoId,
    undo,
    runUndo,
    dismissUndo,
    refresh,
    announce,
    liveMessage,
  };

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>;
}

/** Exposed so Settings can write the to-do preference columns. */
export function useTodoPreferences() {
  const { preferences, updatePreferences, saveError } = usePreferences();
  return {
    prefs: resolveTodoPreferences(preferences as unknown as Record<string, unknown>),
    update: updatePreferences,
    saveError,
  };
}
