-- ============================================================
-- Ruang v1.0 — Complete Database Schema
-- Safe to run on a fresh or existing Supabase project.
-- Re-runnable (idempotent): uses IF NOT EXISTS + DROP POLICY IF EXISTS.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ── Tables ──────────────────────────────────────────────────

create table if not exists users (
  id                        uuid        primary key references auth.users(id) on delete cascade,
  email                     text        not null unique,
  name                      text        not null,
  avatar_url                text,
  accent_color              text,
  typography_preference     text,
  surface_preference        text,
  density_preference        text,
  landing_page_preference   text,
  theme_preference          text,
  created_at                timestamptz default now()
);

create table if not exists spaces (
  id          uuid        primary key default uuid_generate_v4(),
  name        text        not null,
  color       text        not null default '#738290',
  icon        text,
  owner_id    uuid        not null references users(id) on delete cascade,
  parent_id   uuid        references spaces(id) on delete cascade,
  path        text        not null,
  depth       int         not null default 0 check (depth between 0 and 2),
  is_shared   boolean     not null default false,
  created_at  timestamptz default now()
);

create index if not exists spaces_owner_id_idx on spaces(owner_id);
create index if not exists spaces_parent_id_idx on spaces(parent_id);

create table if not exists notes (
  id                uuid        primary key default uuid_generate_v4(),
  user_id           uuid        not null references users(id) on delete cascade,
  type              text        not null default 'note' check (type in ('note', 'checklist')),
  title             text,
  content           jsonb,
  space_id          uuid        references spaces(id) on delete set null,
  tags              jsonb       not null default '[]',
  pinned_date       date,
  pinned_date_end   date,
  is_pinned_to_home boolean     not null default false,
  is_public         boolean     not null default false,
  published_at      timestamptz,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create index if not exists notes_user_id_idx     on notes(user_id);
create index if not exists notes_space_id_idx    on notes(space_id);
create index if not exists notes_updated_at_idx  on notes(updated_at desc);
create index if not exists notes_pinned_date_idx on notes(pinned_date) where pinned_date is not null;
create index if not exists notes_title_gin_idx   on notes using gin(to_tsvector('english', coalesce(title, '')));

create table if not exists widgets (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references users(id) on delete cascade,
  note_id     uuid        references notes(id) on delete cascade,
  type        text        not null check (type in ('reminder', 'file', 'link')),
  content     jsonb       not null default '{}',
  created_at  timestamptz default now()
);

create index if not exists widgets_user_id_idx on widgets(user_id);
create index if not exists widgets_note_id_idx on widgets(note_id);

create table if not exists files (
  id              uuid        primary key default uuid_generate_v4(),
  widget_id       uuid        not null references widgets(id) on delete cascade,
  uploaded_by     uuid        not null references users(id) on delete cascade,
  filename        text        not null,
  r2_object_key   text        not null unique,
  r2_bucket       text        not null,
  mime_type       text        not null,
  size_bytes      bigint      not null default 0,
  created_at      timestamptz default now()
);

create table if not exists reminder_deliveries (
  id              uuid        primary key default uuid_generate_v4(),
  widget_id       uuid        not null references widgets(id) on delete cascade,
  recipient_id    uuid        not null references users(id) on delete cascade,
  channel         text        not null default 'email',
  status          text        not null default 'pending',
  scheduled_at    timestamptz,
  sent_at         timestamptz,
  error_message   text
);

create table if not exists notifications (
  id              uuid        primary key default uuid_generate_v4(),
  recipient_id    uuid        not null references users(id) on delete cascade,
  actor_id        uuid        references users(id) on delete set null,
  type            text        not null,
  message         text        not null,
  is_read         boolean     not null default false,
  created_at      timestamptz default now()
);

create index if not exists notifications_recipient_id_idx on notifications(recipient_id);
create index if not exists notifications_is_read_idx on notifications(recipient_id, is_read) where is_read = false;

-- ── Row-Level Security ───────────────────────────────────────

alter table users               enable row level security;
alter table spaces              enable row level security;
alter table notes               enable row level security;
alter table widgets             enable row level security;
alter table files               enable row level security;
alter table reminder_deliveries enable row level security;
alter table notifications       enable row level security;

-- Drop legacy policies so this file is safe to re-run
drop policy if exists "users_own"               on users;
drop policy if exists "spaces_owner"            on spaces;
drop policy if exists "notes_owner"             on notes;
drop policy if exists "widgets_owner"           on widgets;
drop policy if exists "files_owner"             on files;
drop policy if exists "notifications_recipient" on notifications;

-- Drop new-style policies too (re-run safety)
drop policy if exists "users: select own"  on users;
drop policy if exists "users: insert own"  on users;
drop policy if exists "users: update own"  on users;

drop policy if exists "spaces: select own" on spaces;
drop policy if exists "spaces: insert own" on spaces;
drop policy if exists "spaces: update own" on spaces;
drop policy if exists "spaces: delete own" on spaces;

drop policy if exists "notes: select own"  on notes;
drop policy if exists "notes: insert own"  on notes;
drop policy if exists "notes: update own"  on notes;
drop policy if exists "notes: delete own"  on notes;

drop policy if exists "widgets: select own" on widgets;
drop policy if exists "widgets: insert own" on widgets;
drop policy if exists "widgets: update own" on widgets;
drop policy if exists "widgets: delete own" on widgets;

drop policy if exists "files: select own"  on files;
drop policy if exists "files: insert own"  on files;
drop policy if exists "files: delete own"  on files;

drop policy if exists "reminder_deliveries: select own" on reminder_deliveries;

drop policy if exists "notifications: select own" on notifications;
drop policy if exists "notifications: update own" on notifications;

-- users
create policy "users: select own"
  on users for select to authenticated
  using ((select auth.uid()) = id);

create policy "users: insert own"
  on users for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "users: update own"
  on users for update to authenticated
  using      ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- spaces
create policy "spaces: select own"
  on spaces for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy "spaces: insert own"
  on spaces for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "spaces: update own"
  on spaces for update to authenticated
  using      ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "spaces: delete own"
  on spaces for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- notes
create policy "notes: select own"
  on notes for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "notes: insert own"
  on notes for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "notes: update own"
  on notes for update to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "notes: delete own"
  on notes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- widgets
create policy "widgets: select own"
  on widgets for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "widgets: insert own"
  on widgets for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "widgets: update own"
  on widgets for update to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "widgets: delete own"
  on widgets for delete to authenticated
  using ((select auth.uid()) = user_id);

-- files
create policy "files: select own"
  on files for select to authenticated
  using ((select auth.uid()) = uploaded_by);

create policy "files: insert own"
  on files for insert to authenticated
  with check ((select auth.uid()) = uploaded_by);

create policy "files: delete own"
  on files for delete to authenticated
  using ((select auth.uid()) = uploaded_by);

-- reminder_deliveries (read-only for recipient; writes are server-side only)
create policy "reminder_deliveries: select own"
  on reminder_deliveries for select to authenticated
  using ((select auth.uid()) = recipient_id);

-- notifications
create policy "notifications: select own"
  on notifications for select to authenticated
  using ((select auth.uid()) = recipient_id);

create policy "notifications: update own"
  on notifications for update to authenticated
  using      ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

-- ── Grants (PostgREST / Data API) ───────────────────────────
-- Required so the anon/authenticated roles can reach these tables
-- through the Supabase REST API. RLS policies above control row access.

grant usage on schema public to anon, authenticated;

grant select                         on users                to authenticated;
grant select, insert, update, delete on spaces               to authenticated;
grant select, insert, update, delete on notes                to authenticated;
grant select, insert, update, delete on widgets              to authenticated;
grant select, insert, delete         on files                to authenticated;
grant select                         on reminder_deliveries  to authenticated;
grant select, update                 on notifications        to authenticated;

-- ── Triggers ────────────────────────────────────────────────

-- Automatically create a public.users row whenever a new auth user is created.
-- Uses ON CONFLICT DO NOTHING so it is safe even if the row already exists
-- (e.g. from a manual insert or a retry). The auth.ts signIn callback relies
-- on this trigger and must NOT perform its own insert after admin.createUser().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Automatically bump updated_at on every note update.
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_updated_at on notes;
create trigger notes_updated_at
  before update on notes
  for each row execute procedure public.update_updated_at();
