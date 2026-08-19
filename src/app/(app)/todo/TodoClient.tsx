'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { TodoFilter, TodoGroups } from '@/types';
import { FocusMode } from '@/components/todos/FocusMode';
import { MigrationCard } from '@/components/todos/MigrationCard';
import { MobileQuickAddSheet } from '@/components/todos/MobileQuickAddSheet';
import { TodoDetailPanel } from '@/components/todos/TodoDetailPanel';
import { TodoDragProvider } from '@/components/todos/TodoDragContext';
import { TodoFilterBar } from '@/components/todos/TodoFilterBar';
import { TodoListView } from '@/components/todos/TodoListView';
import { TodoProvider, useTodos } from '@/components/todos/TodoProvider';

/** Last date the rollover check ran, so it fires once a day and not per navigation. */
const ROLLOVER_KEY = 'ruang_todo_rollover_date';

export function TodoClient({
  initialGroups,
  initialFilter,
}: {
  initialGroups: TodoGroups | null;
  /** Only set when the URL named one; otherwise the client restores its own. */
  initialFilter?: TodoFilter;
}) {
  return (
    <TodoProvider initialGroups={initialGroups} initialFilter={initialFilter}>
      <TodoDragProvider>
        <TodoScreen />
      </TodoDragProvider>
    </TodoProvider>
  );
}

function TodoScreen() {
  const { error, liveMessage, undo, runUndo, dismissUndo, refresh, announce } = useTodos();
  const searchParams = useSearchParams();
  const [focusOpen, setFocusOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const composeRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /*
   * The height of the scroll region, published as a custom property.
   *
   * The Anytime column in the All view is sticky and capped so it scrolls
   * independently of the dated list beside it, and that cap has to be the
   * region's height — not the viewport's, which is what it used to read. There
   * is no CSS unit for "my scrollport", and the region's height depends on the
   * range bar, which wraps on a narrow window, so it is measured.
   */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const publish = () => el.style.setProperty('--todo-scroll-h', `${el.clientHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /*
   * `?compose=1` is how the FAB hands off. On a desktop it focuses the
   * quick-add bar; on a phone it opens the bottom sheet, because a focused
   * field at the top of the page is behind the keyboard there.
   */
  useEffect(() => {
    if (searchParams.get('compose') !== '1') return;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (isMobile) setSheetOpen(true);
    else composeRef.current?.querySelector('input')?.focus();

    // Strip the param so a refresh does not reopen it — the pattern
    // NoteEditor uses for `?widget=`.
    const url = new URL(window.location.href);
    url.searchParams.delete('compose');
    window.history.replaceState({}, '', url.toString());
  }, [searchParams]);

  /*
   * Rollover, once a day.
   *
   * The date of the last run is kept in localStorage purely to avoid a wasted
   * request on every navigation — the server re-checks the setting and the
   * dates itself, so a cleared cache or a second device costs one no-op call
   * rather than moving anything twice.
   */
  useEffect(() => {
    const today = new Date().toLocaleDateString('en-CA');
    if (window.localStorage.getItem(ROLLOVER_KEY) === today) return;
    window.localStorage.setItem(ROLLOVER_KEY, today);

    fetch('/api/todos/rollover', { method: 'POST' })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { moved?: number } | null) => {
        if (body?.moved) {
          refresh();
          announce(`Moved ${body.moved} unfinished to-dos to today`);
        }
      })
      .catch(() => {
        // Rollover failing is not worth a message: the to-dos are still there,
        // just still dated yesterday, and the next load tries again.
      });
  }, [announce, refresh]);

  /* `N` opens quick add, `F` opens focus mode — both ignored while typing. */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (window.matchMedia('(max-width: 767px)').matches) setSheetOpen(true);
        else composeRef.current?.querySelector('input')?.focus();
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setFocusOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    /*
      The page fills the content area exactly and scrolls a region inside
      itself, the way the calendar does — it does not grow the document.

      Two things follow from that, and both were asked for. The range bar stays
      where it is instead of scrolling away, so "which week am I looking at" and
      the switch to Month are always in reach. And the scrollbar belongs to the
      list rather than to the window, so the fixed navbar and sidebar are no
      longer framing a page that slides underneath them.

      No `overflow-hidden` on this box, deliberately. The scroll region's own
      `min-h-0` already stops it growing past the height, and the overlays below
      — the detail drawer, focus mode, the undo toast — are `fixed` inside the
      shell's `.animate-fadeUp`, which keeps a transform after it runs and so is
      their containing block. An `overflow-hidden` in between would clip them.
    */
    <div className="flex flex-col" style={{ height: 'var(--app-content-h)' }}>
      <div className="flex-shrink-0">
        <TodoFilterBar onFocus={() => setFocusOpen(true)} />
      </div>

      {error && (
        <p
          role="alert"
          className="m-0 flex-shrink-0 px-6 py-2.5 text-12 text-danger-dark bg-danger-bg border-b border-danger-border"
        >
          {error}
        </p>
      )}

      {/*
        The scroll region. `data-app-scroll` is how PeriodView finds the box it
        has to anchor against when it prepends a week — see lib/scrollHost.ts.
      */}
      <div
        ref={scrollRef}
        data-app-scroll=""
        className="flex-1 min-h-0 overflow-y-auto overscroll-none bg-bg-base"
      >
        <div className="px-8 pt-5 empty:hidden">
          <MigrationCard />
        </div>

        <TodoListView composeRef={composeRef} />
      </div>

      <TodoDetailPanel />
      {focusOpen && <FocusMode onClose={() => setFocusOpen(false)} />}
      {sheetOpen && <MobileQuickAddSheet onClose={() => setSheetOpen(false)} />}

      {undo && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 z-[125] bg-bg-base border border-border-medium rounded-widget shadow-modal px-4 py-3 flex items-center gap-4 animate-fadeUp"
          style={{ bottom: 'calc(var(--fab-bottom) + 8px)' }}
        >
          <span className="text-12.5 text-text-primary truncate max-w-[200px]">
            {undo.title} · done
          </span>
          <button
            type="button"
            onClick={runUndo}
            className="text-12.5 font-medium text-accent-blue-dark hover:underline"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={dismissUndo}
            aria-label="Dismiss"
            className="text-11.5 text-text-faint hover:text-text-secondary"
          >
            ×
          </button>
        </div>
      )}

      {/*
        The live region. Completion, moves and reorders all happen without
        anything moving focus, so without this a screen-reader user gets no
        confirmation that a checkbox or a Ctrl+↓ did anything at all.
      */}
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>
    </div>
  );
}
