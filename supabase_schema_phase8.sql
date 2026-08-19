-- ═══════════════════════════════════════════════════════════════════════════
-- Ruang — phase 8: indexes for the to-do query shapes the app actually issues
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Additive and idempotent. Nothing here changes data or privileges; it is
-- purely about the plans Postgres picks for the four statements the To-do page
-- runs most, plus the ones the calendar merge added.
--
-- Run it after phase 7. Order against the other files does not matter.
--
-- ── Why this file exists ───────────────────────────────────────────────────
--
-- Phase 7's indexes were written against the query shapes as they were
-- designed. The routes have since changed shape in three ways that the
-- existing indexes do not cover:
--
--   1. `loadTodoGroups` filters with a three-branch OR
--      (`in-range` OR `undated` OR `open-and-past`). Postgres plans each branch
--      separately and BitmapOr's the results, so the undated branch needs an
--      index that can serve `due_date IS NULL` for one user without walking
--      every row that user owns. `todos_user_due_position_idx` technically
--      can — NULLs sort last in a btree — but only by scanning to the end of
--      the user's range.
--
--   2. `loadTodoCounts` is now one statement over
--      `(user_id, parent_id IS NULL)` filtered by
--      `is_completed = false OR completed_at >= <month start>`, instead of four
--      `head: true` counts. The partial index below matches the open half of
--      that predicate exactly, including `parent_id IS NULL`, which the phase 7
--      index does not carry.
--
--   3. `/calendar` now loads to-dos with filter `all` — no date predicate at
--      all — so the plan is a straight `user_id` range scan and wants the
--      narrowest index that can answer it.
--
-- None of these were making the app slow on their own: the latency this
-- release fixes was round trips (five HTTP requests per page load, four per
-- checkbox) and client re-renders, not query time. These indexes stop that
-- from becoming untrue as the table grows.
--
-- ── What could NOT be checked ──────────────────────────────────────────────
--
-- The live database was not reachable from the environment this was written
-- in — outbound access to `*.supabase.co` and `mcp.supabase.com` is blocked by
-- the sandbox's network policy, so no `EXPLAIN`, no `pg_stat_statements`, and
-- no inspection of what has actually drifted on the deployed project. Every
-- statement below is therefore written to be safe on a database in any state
-- (all `if not exists`), and the verification queries at the bottom are the
-- ones to run by hand in the SQL editor.
--
-- Two things worth checking there that this file cannot check for you:
--
--   * `select * from pg_stat_user_indexes where relname = 'todos';` — if
--     `idx_scan` is 0 on an index after a week of normal use, it is dead weight
--     on every write and should be dropped.
--   * The Supabase dashboard's slow-query report. If a to-do statement appears
--     there at all after this release, it will be the `or(...)` in
--     `loadTodoGroups`; the fix is to split it into two statements rather than
--     to add a fourth index.

-- ── 1. Undated to-dos ──────────────────────────────────────────────────────
--
-- The Unassigned tray, and the `due_date.is.null` branch of every filtered
-- load. Partial, so it holds only the rows that branch can return — typically
-- a small fraction of the table, and it stays small as dated work accumulates.

create index if not exists todos_user_undated_idx
  on todos(user_id, position)
  where due_date is null and parent_id is null;

-- ── 2. Open parent to-dos ──────────────────────────────────────────────────
--
-- Matches `loadTodoCounts`'s open half and the carried-over branch
-- (`due_date < today and is_completed = false`) in one index. `parent_id is
-- null` is in the predicate rather than the key because every count and every
-- top-level group excludes sub-tasks — putting it in the WHERE clause keeps the
-- index smaller than putting it in the key would.

create index if not exists todos_user_open_parents_idx
  on todos(user_id, due_date, position)
  where is_completed = false and parent_id is null;

-- ── 3. Recently completed ──────────────────────────────────────────────────
--
-- "Done this month" and the streak. Phase 7's `todos_completed_at_idx` covers
-- the ordering; this one adds `parent_id is null` so the count does not have to
-- re-check every completed sub-task.

create index if not exists todos_user_completed_parents_idx
  on todos(user_id, completed_at desc)
  where completed_at is not null and parent_id is null;

-- ── 4. Attachment lookup by to-do ──────────────────────────────────────────
--
-- The full row select embeds `todo_attachments` for every to-do in the window.
-- Phase 7 indexed `(todo_id)`; including `user_id` lets the embed be answered
-- without a heap fetch per attachment when the planner chooses an index-only
-- scan.

create index if not exists todo_attachments_todo_user_idx
  on todo_attachments(todo_id, user_id);

-- ── 5. Confirm ─────────────────────────────────────────────────────────────
--
--   select indexname, indexdef from pg_indexes
--    where schemaname = 'public' and tablename in ('todos', 'todo_attachments')
--    order by indexname;
--
--   -- Which indexes are earning their keep (run after a few days of use):
--   select relname, indexrelname, idx_scan, idx_tup_read
--     from pg_stat_user_indexes
--    where relname in ('todos', 'todo_attachments')
--    order by idx_scan;
--
--   -- The filtered-load plan. Substitute a real user id and today's date;
--   -- expect a BitmapOr over index scans, never a Seq Scan on todos.
--   explain (analyze, buffers)
--   select * from todos
--    where user_id = '00000000-0000-0000-0000-000000000000'
--      and ( (due_date >= current_date and due_date <= current_date)
--            or due_date is null
--            or (due_date < current_date and is_completed = false) );
--
-- RLS, privileges and the `todos_updated_at` trigger are unchanged from
-- phase 7 and deliberately not re-asserted here — re-run phase 7 if any of
-- those need restoring. As always, if a write fails with "column not found in
-- the schema cache" straight after a migration:
--
--   notify pgrst, 'reload schema';
