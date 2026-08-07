-- Ruang Phase 2 — additive schema changes
-- Safe to re-run (idempotent). Apply in Supabase SQL editor after supabase_schema.sql.

-- ── Note locking ──────────────────────────────────────────────────
alter table notes add column if not exists is_locked boolean not null default false;

-- ── Version history ────────────────────────────────────────────────
create table if not exists note_versions (
  id          uuid primary key default uuid_generate_v4(),
  note_id     uuid not null references notes(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  content     jsonb not null,
  title       text,
  created_at  timestamptz default now()
);

create index if not exists note_versions_note_id_idx on note_versions(note_id);
create index if not exists note_versions_user_id_idx on note_versions(user_id);

alter table note_versions enable row level security;

-- Drop existing policies if re-running
drop policy if exists "note_versions: select own" on note_versions;
drop policy if exists "note_versions: insert own" on note_versions;
drop policy if exists "note_versions: delete own" on note_versions;

create policy "note_versions: select own"
  on note_versions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "note_versions: insert own"
  on note_versions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "note_versions: delete own"
  on note_versions for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on note_versions to authenticated;
