-- ============================================================
-- Ruang — Phase 7: first-class To-dos
--
-- Additive and idempotent. Safe to run on a database that has had every
-- previous file applied, and safe to run twice. Run it in the Supabase SQL
-- editor.
--
-- Replaces the checklist-note workaround (notes.type = 'checklist') with real
-- rows: dates and times set independently, fractional ordering that survives a
-- cross-date drag, sub-tasks as self-referencing rows, recurrence and reminders
-- as jsonb, and attachments pointing at either a file or an existing note.
--
-- Conventions follow the earlier files: uuid_generate_v4() defaults, RLS keyed
-- on user_id via (select auth.uid()), the shared update_updated_at() trigger,
-- and phase 4's grant posture (see section 4 — these tables are deliberately
-- NOT granted to anon/authenticated).
-- ============================================================

-- ── 1. Tables ──────────────────────────────────────────────────────────────

create table if not exists todos (
  id                    uuid        primary key default uuid_generate_v4(),
  user_id               uuid        not null references users(id) on delete cascade,
  -- A sub-task is a todo whose parent_id is set. One level only: the API
  -- rejects a parent_id that itself has a parent. That rule cannot be a CHECK
  -- (it needs a second row), so it lives in api/todos and is documented here
  -- so nobody adds a second level by writing SQL directly.
  parent_id             uuid        references todos(id) on delete cascade,
  space_id              uuid        references spaces(id) on delete set null,
  title                 text        not null check (char_length(title) between 1 and 500),
  description           text        check (description is null or char_length(description) <= 2000),
  -- Deliberately two nullable columns rather than one timestamptz. A to-do can
  -- be due on a day with no time ("Wednesday"), and the two are set
  -- independently in the UI. Collapsing them would force a fake midnight onto
  -- every dateless item and make "has a time" unaskable.
  due_date              date,
  due_time              time,
  estimate_minutes      int         check (estimate_minutes is null or estimate_minutes between 1 and 1440),
  -- Fractional ordering: a drop between two rows writes the midpoint, so a
  -- reorder is one UPDATE instead of renumbering the whole day. Scoped to
  -- (user_id, due_date); the unassigned tray is the due_date is null bucket.
  --
  -- The bounds also reject NaN, which double precision otherwise accepts and
  -- which sorts greater than every real value — one bad write would pin a row
  -- to the bottom of its group forever.
  position              double precision not null default 0
                                    check (position >= -1e15 and position <= 1e15),
  is_completed          boolean     not null default false,
  completed_at          timestamptz,
  -- On a parent: whether its own checkbox is gated by its sub-tasks.
  subtask_mode          text        not null default 'independent'
                                    check (subtask_mode in ('independent', 'dependent')),
  -- {freq: daily|weekly|monthly|custom, interval: int, byday: [0-6],
  --  ends: {type: never|on|after, date, count}, on_missed: skip|rollover}
  recurrence            jsonb,
  -- Set on generated instances, pointing at the row that carries the rule.
  recurrence_parent_id  uuid        references todos(id) on delete set null,
  -- {lead: '15m'|'30m'|'1h'|'3h'|'1d'|'3d'|'1w', repeat_count: 1|2|null}
  -- null repeat_count means "nudge until done".
  reminder              jsonb,
  -- The checklist note this to-do was converted from, if any.
  source_note_id        uuid        references notes(id) on delete set null,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

-- Ordering within a group. Also serves every (user_id) and (user_id, due_date)
-- lookup by the leftmost-prefix rule, so no separate index for those.
create index if not exists todos_user_due_position_idx
  on todos(user_id, due_date, position);

-- The hot path: every list view asks for open to-dos first. Partial, so it
-- stays small as completed rows accumulate.
create index if not exists todos_user_open_idx
  on todos(user_id, due_date, position) where is_completed = false;

-- Powers "done at 08:10", the Done section and the streak count.
create index if not exists todos_completed_at_idx
  on todos(user_id, completed_at desc) where completed_at is not null;

-- Foreign-key indexes. Postgres does not create these automatically, and
-- without them every delete of a parent row, space, note or recurrence
-- template has to sequentially scan todos to find referencing rows.
create index if not exists todos_parent_idx
  on todos(parent_id) where parent_id is not null;
create index if not exists todos_space_idx
  on todos(space_id) where space_id is not null;
create index if not exists todos_recurrence_parent_idx
  on todos(recurrence_parent_id) where recurrence_parent_id is not null;
create index if not exists todos_source_note_idx
  on todos(source_note_id) where source_note_id is not null;

create table if not exists todo_attachments (
  id          uuid        primary key default uuid_generate_v4(),
  todo_id     uuid        not null references todos(id) on delete cascade,
  user_id     uuid        not null references users(id) on delete cascade,
  kind        text        not null check (kind in ('file', 'note')),
  file_id     uuid        references files(id) on delete cascade,
  note_id     uuid        references notes(id) on delete cascade,
  created_at  timestamptz default now(),
  -- Exactly one target, and it has to match `kind`.
  constraint todo_attachments_one_target check (
    (kind = 'file' and file_id is not null and note_id is null) or
    (kind = 'note' and note_id is not null and file_id is null)
  )
);

create index if not exists todo_attachments_todo_idx on todo_attachments(todo_id);
create index if not exists todo_attachments_user_idx on todo_attachments(user_id);
create index if not exists todo_attachments_file_idx on todo_attachments(file_id) where file_id is not null;
create index if not exists todo_attachments_note_idx on todo_attachments(note_id) where note_id is not null;

-- The same note or file attached twice to one to-do is a duplicate row with no
-- meaning, and the UI has no way to tell the two apart.
create unique index if not exists todo_attachments_unique_note_idx
  on todo_attachments(todo_id, note_id) where note_id is not null;
create unique index if not exists todo_attachments_unique_file_idx
  on todo_attachments(todo_id, file_id) where file_id is not null;

-- ── 2. Preference columns ──────────────────────────────────────────────────
--
-- Same shape as the appearance preferences: nullable means "not chosen", and
-- the app resolves the default. Constraints are dropped and recreated rather
-- than guarded by name — see the phase 5 header for why an `if not exists`
-- guard on a constraint name silently skips a changed value list.

alter table public.users
  add column if not exists todo_default_assignment text,
  add column if not exists todo_done_behavior      text,
  add column if not exists todo_subtask_mode       text,
  add column if not exists todo_show_estimates     boolean,
  add column if not exists todo_show_progress      boolean,
  add column if not exists todo_today_cap          int,
  add column if not exists todo_rollover           boolean;

-- `add constraint` validates existing rows, so out-of-list values have to go
-- back to NULL first or the ALTER fails outright on a drifted database.
update public.users set todo_default_assignment = null
 where todo_default_assignment is not null
   and todo_default_assignment not in ('today', 'unassigned');

update public.users set todo_done_behavior = null
 where todo_done_behavior is not null
   and todo_done_behavior not in ('stay', 'section');

update public.users set todo_subtask_mode = null
 where todo_subtask_mode is not null
   and todo_subtask_mode not in ('independent', 'dependent');

update public.users set todo_today_cap = null
 where todo_today_cap is not null
   and todo_today_cap not between 1 and 50;

alter table public.users
  drop constraint if exists users_todo_default_assignment_check,
  drop constraint if exists users_todo_done_behavior_check,
  drop constraint if exists users_todo_subtask_mode_check,
  drop constraint if exists users_todo_today_cap_check;

alter table public.users
  add constraint users_todo_default_assignment_check
    check (todo_default_assignment is null or todo_default_assignment in ('today', 'unassigned')),
  add constraint users_todo_done_behavior_check
    check (todo_done_behavior is null or todo_done_behavior in ('stay', 'section')),
  add constraint users_todo_subtask_mode_check
    check (todo_subtask_mode is null or todo_subtask_mode in ('independent', 'dependent')),
  add constraint users_todo_today_cap_check
    check (todo_today_cap is null or todo_today_cap between 1 and 50);

-- ── 3. Row-Level Security ──────────────────────────────────────────────────
--
-- Every server query uses the service-role client, which bypasses RLS, so
-- these policies never execute today (see rule 10 in CLAUDE.md — the filter
-- each query carries is the real control). They are here for the same reason
-- phase 4 enabled RLS on all eight existing tables: if a browser Supabase
-- client is ever added, the tables are already closed rather than open.
--
-- auth.uid() is wrapped in a SELECT so it is evaluated once per statement
-- instead of once per row.

alter table todos            enable row level security;
alter table todo_attachments enable row level security;

drop policy if exists "todos: select own" on todos;
drop policy if exists "todos: insert own" on todos;
drop policy if exists "todos: update own" on todos;
drop policy if exists "todos: delete own" on todos;

drop policy if exists "todo_attachments: select own" on todo_attachments;
drop policy if exists "todo_attachments: insert own" on todo_attachments;
drop policy if exists "todo_attachments: delete own" on todo_attachments;

create policy "todos: select own"
  on todos for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "todos: insert own"
  on todos for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "todos: update own"
  on todos for update to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "todos: delete own"
  on todos for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "todo_attachments: select own"
  on todo_attachments for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "todo_attachments: insert own"
  on todo_attachments for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "todo_attachments: delete own"
  on todo_attachments for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ── 4. Privileges ──────────────────────────────────────────────────────────
--
-- No `grant ... to authenticated` here, deliberately.
--
-- Phase 4 revoked USAGE on schema public from anon and authenticated and set
-- default privileges to match, because nothing in this app talks to PostgREST
-- from the browser — every read and write goes through a Next.js route using
-- the service role. Granting these two tables to `authenticated` would put
-- them back on the Data API the moment schema usage is restored, which is the
-- opposite of what phase 4 decided.
--
-- The revokes below are belt and braces: phase 4's ALTER DEFAULT PRIVILEGES
-- only covers objects created by the role that ran it, and this file may be
-- run by a different one.
--
-- Reversible: if a browser Supabase client is ever added, grant back exactly
-- what it needs here (and re-grant usage on the schema), with the RLS policies
-- in section 3 already in place.

revoke all on todos            from anon, authenticated;
revoke all on todo_attachments from anon, authenticated;

-- ── 5. Triggers ────────────────────────────────────────────────────────────
--
-- Reuses the existing update_updated_at() from supabase_schema.sql. Phase 6
-- revoked EXECUTE on it from PUBLIC, anon and authenticated; that does not
-- affect this trigger, because Postgres checks EXECUTE when the trigger is
-- created, not each time it fires.

drop trigger if exists todos_updated_at on todos;
create trigger todos_updated_at
  before update on todos
  for each row execute procedure public.update_updated_at();

-- ── 6. Confirm ─────────────────────────────────────────────────────────────
--
--   select tablename, rowsecurity from pg_tables
--    where schemaname = 'public' and tablename in ('todos','todo_attachments');
--
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'todos' order by policyname;
--
--   select has_table_privilege('authenticated', 'todos', 'select');  -- false
--
-- PostgREST caches the schema. If a write fails with "column not found in the
-- schema cache" right after this runs — which is also how a missing preference
-- column presents in Settings — reload it:
--
--   notify pgrst, 'reload schema';
