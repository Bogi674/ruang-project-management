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
import type { Todo, TodoAttachment, TodoFilter, TodoGroups } from '@/types';

const FILTER_KEY = 'ruang_todo_filter';
/** How long a completed row can be pulled back out of Done. */
export const UNDO_WINDOW_MS = 3000;

export interface UndoEntry {
  todoId: string;
  title: string;
  previous: Todo;
  expiresAt: number;
}

/**
 * State and actions are two contexts, not one.
 *
 * Every to-do row consumes this provider, and a single context meant that
 * ticking one checkbox re-rendered every row on the page — the actions object
 * was rebuilt on each render, so even a row whose data had not changed saw a
 * new context value. Actions are identity-stable for the life of the provider
 * and live on their own; rows subscribe to those alone and are `React.memo`'d
 * against their own `todo`. Only the rows that actually changed re-render.
 */
interface TodoActions {
  setFilter: (next: TodoFilter) => void;
  setSpaceFilter: (id: string | null) => void;

  createTodo: (input: Partial<Todo> & { title: string }) => Promise<Todo | null>;
  updateTodo: (id: string, patch: Partial<Todo>) => Promise<boolean>;
  toggleComplete: (id: string) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  reorder: (entries: { id: string; position: number; due_date?: string | null }[]) => Promise<void>;
  attach: (todoId: string, body: Record<string, unknown>) => Promise<TodoAttachment | null>;
  detach: (todoId: string, attachmentId: string) => Promise<void>;

  setOpenTodoId: (id: string | null) => void;
  runUndo: () => void;
  dismissUndo: () => void;

  refresh: () => void;
  /**
   * Pull in a date range that is not part of the current filter's window and
   * merge it into what is already loaded. This is how the Week and Month lists
   * scroll into neighbouring periods.
   */
  loadRange: (start: string, end: string) => Promise<void>;
  /** Announces to the live region — "Marked done", "Moved to Wednesday 19". */
  announce: (message: string) => void;
  prefs: ResolvedTodoPreferences;
}

interface TodoState {
  /** Flat, including sub-tasks. Grouped views read `groups` instead. */
  todos: Todo[];
  groups: TodoGroups;
  loading: boolean;
  error: string | null;
  filter: TodoFilter;
  spaceFilter: string | null;
  openTodoId: string | null;
  undo: UndoEntry | null;
  liveMessage: string;
}

export type TodoContextValue = TodoState & TodoActions;

const TodoStateContext = createContext<TodoState | null>(null);
const TodoActionsContext = createContext<TodoActions | null>(null);

/** Everything. For the screens that render lists — not for a single row. */
export function useTodos(): TodoContextValue {
  const state = useContext(TodoStateContext);
  const actions = useContext(TodoActionsContext);
  if (!state || !actions) throw new Error('useTodos must be used inside a TodoProvider');
  return useMemo(() => ({ ...state, ...actions }), [state, actions]);
}

/**
 * Actions and preferences only, with a context value that never changes
 * identity. This is what a row should use: it can then be memoised and will
 * re-render only when its own to-do does.
 */
export function useTodoActions(): TodoActions {
  const actions = useContext(TodoActionsContext);
  if (!actions) throw new Error('useTodoActions must be used inside a TodoProvider');
  return actions;
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
  serverToday,
}: {
  children: React.ReactNode;
  initialGroups?: TodoGroups | null;
  initialFilter?: TodoFilter;
  /** The server's local date string. When it differs from the client's date the
   *  SSR payload is for the wrong day (timezone mismatch) and must not be used
   *  to skip the first client fetch. */
  serverToday?: string;
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
  /*
   * The SSR payload is only usable when the server and the browser agree on
   * what day it is. They do not for seven hours a day in UTC+7: the server
   * renders the wrong day's window, the corrective fetch is already on its way,
   * and treating the stale payload as loaded paints "Nothing due today" over a
   * full list before replacing it. Staying in the loading state shows the
   * skeleton instead, which is honest and does not flash.
   */
  const staleInitial = Boolean(initialGroups) && Boolean(serverToday) && serverToday !== todayISO();
  const [loading, setLoading] = useState(!initialGroups || staleInitial);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilterState] = useState<TodoFilter>(initialFilter ?? 'today');
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
   * The filter is restored from localStorage in an effect rather than in the
   * useState initialiser: the server renders the default and a mismatched
   * first client render is a hydration error.
   */
  useEffect(() => {
    if (!initialFilter) {
      setFilterState(readStored<TodoFilter>(FILTER_KEY, ['today', 'week', 'month', 'all'], 'today'));
    }
  }, [initialFilter]);

  const setFilter = useCallback((next: TodoFilter) => {
    setFilterState(next);
    try {
      window.localStorage.setItem(FILTER_KEY, next);
    } catch {
      /* private mode — the filter just does not persist */
    }
  }, []);

  /*
   * There is no `view` here any more. /todo used to switch between a list and
   * a month grid of its own; the grid moved to /calendar, which is the app's
   * only calendar. The filter bar links there rather than swapping this page's
   * contents out from under the same URL.
   */

  /* ── Loading ───────────────────────────────────────────────────────────── */

  // Bumped to force a reload; also used to discard a response that arrives
  // after the filter has already moved on.
  const [reloadToken, setReloadToken] = useState(0);
  const requestId = useRef(0);
  // Only skip the first fetch when the SSR payload is for the browser's own
  // date — see `staleInitial` above.
  const skipNextFetch = useRef(Boolean(initialGroups) && !staleInitial);

  const refresh = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    // The server already rendered the first filter's payload.
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }

    const id = ++requestId.current;
    setLoading(true);
    const params = new URLSearchParams({ filter, today: todayISO() });
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

  /*
   * Nesting sub-tasks onto their parents produces a new object per parent, and
   * a new object means every memoised row downstream re-renders even when its
   * to-do is untouched. This cache hands back the previous object whenever the
   * parent row and its sub-task rows are the same references as last time, so
   * a change to one to-do invalidates exactly one row.
   */
  const parentCache = useRef(new Map<string, { source: Todo; subs: Todo[]; out: Todo }>());

  const groups = useMemo<TodoGroups>(() => {
    const today = todayISO();
    const byParent = new Map<string, Todo[]>();
    for (const todo of todos) {
      if (!todo.parent_id) continue;
      const list = byParent.get(todo.parent_id) || [];
      list.push(todo);
      byParent.set(todo.parent_id, list);
    }

    const cache = parentCache.current;
    const next = new Map<string, { source: Todo; subs: Todo[]; out: Todo }>();

    const parents = todos
      .filter((t) => !t.parent_id)
      .map((t) => {
        const subs = sortByPosition(byParent.get(t.id) || []);
        const cachedEntry = cache.get(t.id);
        const reusable =
          cachedEntry &&
          cachedEntry.source === t &&
          cachedEntry.subs.length === subs.length &&
          cachedEntry.subs.every((sub, i) => sub === subs[i]);

        const entry = reusable
          ? cachedEntry!
          : { source: t, subs, out: { ...t, subtasks: subs } as Todo };
        next.set(t.id, entry);
        return entry.out;
      });

    parentCache.current = next;

    const grouped: TodoGroups = {
      overdue: [],
      dated: {},
      unassigned: [],
      done: {},
      counts,
    };

    for (const todo of sortByPosition(parents)) {
      if (todo.is_completed) {
        const key = todo.due_date || '';
        (grouped.done[key] = grouped.done[key] || []).push(todo);
      } else if (!todo.due_date) {
        grouped.unassigned.push(todo);
      } else if (todo.due_date < today) {
        grouped.overdue.push(todo);
      } else {
        (grouped.dated[todo.due_date] = grouped.dated[todo.due_date] || []).push(todo);
      }
    }
    return grouped;
  }, [todos, counts]);

  /* ── Mutations ─────────────────────────────────────────────────────────── */

  /**
   * Reconcile the headline numbers after a local change.
   *
   * This used to refetch the whole window 1.5 seconds after every mutation,
   * which is what made the page feel like it was fighting the user: a second
   * change landing inside that window was overwritten by the in-flight reload,
   * so a tick or a drag would visibly undo itself. Only the counts come from
   * outside the current window, so only the counts are refetched — one small
   * request, and the rows on screen are never replaced.
   */
  const resyncTimer = useRef<number | null>(null);
  const scheduleResync = useCallback(() => {
    // Tells the sidebar badge to recount straight away.
    emitTodosChanged();
    if (resyncTimer.current) window.clearTimeout(resyncTimer.current);
    resyncTimer.current = window.setTimeout(() => {
      fetch(`/api/todos?count=true&today=${todayISO()}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((next: TodoGroups['counts'] | null) => {
          if (next) setCounts(next);
        })
        .catch(() => {
          /* The numbers stay as the optimistic maths left them. */
        });
    }, 1200);
  }, []);

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
            // `saved` is the light shape — it carries no attachments, so the
            // ones already on the row are kept rather than merged away.
            if (t.id === id) return { ...t, ...saved, attachments: t.attachments };
            if (parent && t.id === parent.id) return { ...t, ...parent };
            return t;
          });
          // A generated instance may fall outside the current filter's window;
          // it is harmless there and the next real load drops it.
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

      // Nudged before the request rather than after it, so the header count
      // moves with the checkbox instead of a round trip later.
      setCounts((c) => ({ ...c, total: Math.max(0, c.total + (next ? -1 : 1)) }));
      announce(next ? `Marked ${todo.title} done` : `Reopened ${todo.title}`);

      const ok = await updateTodo(id, {
        is_completed: next,
        // Mirrors what the server stamps, so the "done at 08:10" caption is
        // right immediately rather than after the response lands.
        completed_at: next ? new Date().toISOString() : null,
      });

      if (ok) scheduleResync();
      else setCounts((c) => ({ ...c, total: Math.max(0, c.total + (next ? 1 : -1)) }));
    },
    [announce, prefs.doneBehavior, scheduleResync, updateTodo]
  );

  /*
   * `undo` is shadowed by a ref so this callback can stay identity-stable
   * without reading it inside a state updater — React may run an updater twice
   * in development, and the PATCH would go out twice with it.
   */
  const undoRef = useRef(undo);
  undoRef.current = undo;

  const runUndo = useCallback(() => {
    const entry = undoRef.current;
    if (!entry) return;
    setUndo(null);
    updateTodo(entry.todoId, { is_completed: false, completed_at: null }).then((ok) => {
      if (ok) {
        setCounts((c) => ({ ...c, total: c.total + 1 }));
        announce(`Reopened ${entry.title}`);
      }
    });
  }, [announce, updateTodo]);

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
      setOpenTodoId((open) => (open === id ? null : open));

      try {
        const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        if (todo) announce(`Deleted ${todo.title}`);
        scheduleResync();
      } catch {
        setTodos(previous);
        setError('Could not delete that to-do');
      }
    },
    [announce, scheduleResync]
  );

  /**
   * Persist an order change — and apply it on screen first.
   *
   * This is the whole reason a drag used to look broken: the rows were left
   * where they started until something else happened to reload the page, so a
   * drop across dates appeared to do nothing at all and then jumped minutes
   * later. The new positions (and the new `due_date`, when the drop crossed
   * groups) go into local state immediately; the request is what confirms it.
   *
   * A rejection reloads from the server rather than trying to reverse the
   * drag, since a partial failure leaves no single previous order to restore.
   */
  const reorder = useCallback(
    async (entries: { id: string; position: number; due_date?: string | null }[]) => {
      if (entries.length === 0) return;

      const patch = new Map(entries.map((e) => [e.id, e]));
      setTodos((current) =>
        current.map((t) => {
          const entry = patch.get(t.id);
          if (!entry) return t;
          return 'due_date' in entry
            ? { ...t, position: entry.position, due_date: entry.due_date ?? null }
            : { ...t, position: entry.position };
        })
      );

      try {
        const res = await fetch('/api/todos/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entries),
        });
        if (!res.ok) throw new Error();
        scheduleResync();
      } catch {
        setError('Could not save the new order');
        refresh();
      }
    },
    [refresh, scheduleResync]
  );

  /**
   * Widen the window.
   *
   * Merged by id rather than assigned, for the same reason the post-mutation
   * refetch was removed: the rows on screen are the user's optimistic state and
   * a background response must never replace them. A range that has already
   * been loaded is skipped outright, so scrolling back and forth over the same
   * weeks costs one request each, not one per crossing.
   */
  const loadedRanges = useRef(new Set<string>());
  const loadRange = useCallback(async (start: string, end: string) => {
    const key = `${start}:${end}`;
    if (loadedRanges.current.has(key)) return;
    loadedRanges.current.add(key);

    try {
      const res = await fetch(`/api/todos?filter=all&start=${start}&end=${end}&today=${todayISO()}`);
      if (!res.ok) throw new Error();
      const groups = (await res.json()) as TodoGroups;
      const incoming = flatten(groups);
      if (incoming.length === 0) return;

      setTodos((current) => {
        const byId = new Map(current.map((t) => [t.id, t]));
        let changed = false;
        for (const row of incoming) {
          // An id already in state keeps the copy that is there — it may carry
          // an optimistic change this response predates.
          if (byId.has(row.id)) continue;
          byId.set(row.id, row);
          changed = true;
        }
        return changed ? Array.from(byId.values()) : current;
      });
    } catch {
      // A period that would not load shows as empty; scrolling back over it
      // retries, because the key is dropped again here.
      loadedRanges.current.delete(key);
    }
  }, []);

  // A filter or space change invalidates what "already loaded" means.
  useEffect(() => {
    loadedRanges.current.clear();
  }, [filter, spaceFilter, reloadToken]);

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

  const actions = useMemo<TodoActions>(
    () => ({
      setFilter,
      setSpaceFilter,
      createTodo,
      updateTodo,
      toggleComplete,
      deleteTodo,
      reorder,
      attach,
      detach,
      setOpenTodoId,
      runUndo,
      dismissUndo,
      refresh,
      loadRange,
      announce,
      prefs,
    }),
    [
      announce,
      attach,
      createTodo,
      deleteTodo,
      detach,
      dismissUndo,
      loadRange,
      prefs,
      refresh,
      reorder,
      runUndo,
      setFilter,
      toggleComplete,
      updateTodo,
    ]
  );

  const state = useMemo<TodoState>(
    () => ({
      todos,
      groups,
      loading,
      error,
      filter,
      spaceFilter,
      openTodoId,
      undo,
      liveMessage,
    }),
    [todos, groups, loading, error, filter, spaceFilter, openTodoId, undo, liveMessage]
  );

  return (
    <TodoActionsContext.Provider value={actions}>
      <TodoStateContext.Provider value={state}>{children}</TodoStateContext.Provider>
    </TodoActionsContext.Provider>
  );
}
