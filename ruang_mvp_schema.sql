-- Ruang MVP Schema
-- Run in Supabase SQL editor

-- ─── Extensions ────────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ─── Public ID helper ──────────────────────────────────────────────────────────
create or replace function generate_public_id(prefix text)
returns text as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := prefix || '_';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

-- ─── Users ────────────────────────────────────────────────────────────────────
create table if not exists users (
  id                      uuid primary key default gen_random_uuid(),
  public_id               text unique default generate_public_id('usr'),
  email                   text unique not null,
  name                    text not null,
  avatar_url              text,
  role                    text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  session_timeout_minutes int not null default 10080,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ─── Projects ─────────────────────────────────────────────────────────────────
create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  public_id   text unique default generate_public_id('prj'),
  name        text not null,
  description text,
  color       text not null default '#6366f1',
  created_by  uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Project Members ──────────────────────────────────────────────────────────
create table if not exists project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  role       text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique(project_id, user_id)
);

-- ─── Invitations ──────────────────────────────────────────────────────────────
create table if not exists invitations (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  email      text not null,
  role       text not null default 'editor' check (role in ('owner', 'editor', 'viewer')),
  token      text unique not null default encode(gen_random_bytes(32), 'hex'),
  invited_by uuid not null references users(id) on delete cascade,
  accepted_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now(),
  unique(project_id, email)
);

-- ─── Workstreams ──────────────────────────────────────────────────────────────
create table if not exists workstreams (
  id          uuid primary key default gen_random_uuid(),
  public_id   text unique default generate_public_id('wks'),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  description text,
  color       text not null default '#8b5cf6',
  sort_order  int not null default 0,
  created_by  uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Entries ──────────────────────────────────────────────────────────────────
create table if not exists entries (
  id              uuid primary key default gen_random_uuid(),
  public_id       text unique default generate_public_id('ent'),
  type            text not null check (type in ('note', 'file', 'task', 'reminder', 'link')),
  project_id      uuid not null references projects(id) on delete cascade,
  workstream_id   uuid not null references workstreams(id) on delete cascade,
  created_by      uuid not null references users(id) on delete cascade,
  pinned_date     date,
  pinned_date_end date,
  tags            jsonb not null default '[]',
  content         jsonb not null default '{}',
  is_pinned       bool not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists entries_project_id_idx on entries(project_id);
create index if not exists entries_workstream_id_idx on entries(workstream_id);
create index if not exists entries_pinned_date_idx on entries(pinned_date);
create index if not exists entries_type_idx on entries(type);

-- ─── Entry Assignees ──────────────────────────────────────────────────────────
create table if not exists entry_assignees (
  entry_id   uuid not null references entries(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);

-- ─── Note Versions ────────────────────────────────────────────────────────────
create table if not exists note_versions (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references entries(id) on delete cascade,
  version_num int not null,
  content     jsonb not null,
  created_by  uuid not null references users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists note_versions_entry_id_idx on note_versions(entry_id);

-- ─── Files ────────────────────────────────────────────────────────────────────
create table if not exists files (
  id           uuid primary key default gen_random_uuid(),
  entry_id     uuid not null references entries(id) on delete cascade,
  filename     text not null,
  size         bigint not null,
  mime_type    text not null,
  storage_path text not null,
  created_at   timestamptz not null default now()
);

-- ─── Reminder Deliveries ──────────────────────────────────────────────────────
create table if not exists reminder_deliveries (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references entries(id) on delete cascade,
  user_id     uuid not null references users(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  channel     text not null default 'email'
);

-- ─── Notifications ────────────────────────────────────────────────────────────
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  type       text not null,
  message    text not null,
  read       bool not null default false,
  link       text,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications(user_id);
create index if not exists notifications_read_idx on notifications(read);

-- ─── Row-Level Security ───────────────────────────────────────────────────────
alter table users enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table invitations enable row level security;
alter table workstreams enable row level security;
alter table entries enable row level security;
alter table entry_assignees enable row level security;
alter table note_versions enable row level security;
alter table files enable row level security;
alter table notifications enable row level security;

-- Allow service role to bypass RLS
-- (Service role key bypasses by default in Supabase)

-- Users: readable by authenticated
create policy "users_select" on users for select using (auth.role() = 'authenticated');
create policy "users_update_self" on users for update using (id = auth.uid()::uuid);

-- Projects: select if member
create policy "projects_select" on projects
  for select using (
    id in (select project_id from project_members where user_id = auth.uid()::uuid)
  );

create policy "projects_insert" on projects
  for insert with check (created_by = auth.uid()::uuid);

create policy "projects_update" on projects
  for update using (
    id in (select project_id from project_members where user_id = auth.uid()::uuid and role in ('owner', 'editor'))
  );

create policy "projects_delete" on projects
  for delete using (
    id in (select project_id from project_members where user_id = auth.uid()::uuid and role = 'owner')
  );

-- Project members
create policy "pm_select" on project_members
  for select using (
    project_id in (select project_id from project_members pm2 where pm2.user_id = auth.uid()::uuid)
  );

-- Workstreams
create policy "workstreams_select" on workstreams
  for select using (
    project_id in (select project_id from project_members where user_id = auth.uid()::uuid)
  );

create policy "workstreams_insert" on workstreams
  for insert with check (
    project_id in (select project_id from project_members where user_id = auth.uid()::uuid and role in ('owner', 'editor'))
  );

create policy "workstreams_update" on workstreams
  for update using (
    project_id in (select project_id from project_members where user_id = auth.uid()::uuid and role in ('owner', 'editor'))
  );

create policy "workstreams_delete" on workstreams
  for delete using (
    project_id in (select project_id from project_members where user_id = auth.uid()::uuid and role in ('owner', 'editor'))
  );

-- Entries
create policy "entries_select" on entries
  for select using (
    project_id in (select project_id from project_members where user_id = auth.uid()::uuid)
  );

create policy "entries_insert" on entries
  for insert with check (
    project_id in (select project_id from project_members where user_id = auth.uid()::uuid and role in ('owner', 'editor'))
  );

create policy "entries_update" on entries
  for update using (
    project_id in (select project_id from project_members where user_id = auth.uid()::uuid and role in ('owner', 'editor'))
  );

create policy "entries_delete" on entries
  for delete using (
    project_id in (select project_id from project_members where user_id = auth.uid()::uuid and role in ('owner', 'editor'))
  );

-- Notifications: own only
create policy "notifications_select" on notifications
  for select using (user_id = auth.uid()::uuid);

create policy "notifications_update" on notifications
  for update using (user_id = auth.uid()::uuid);

-- Files
create policy "files_select" on files
  for select using (
    entry_id in (
      select id from entries where project_id in (
        select project_id from project_members where user_id = auth.uid()::uuid
      )
    )
  );

-- ─── Auto-add project creator as owner ────────────────────────────────────────
create or replace function add_project_creator_as_owner()
returns trigger as $$
begin
  insert into project_members (project_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger project_creator_member
  after insert on projects
  for each row execute function add_project_creator_as_owner();

-- ─── Update timestamp trigger ─────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at before update on projects
  for each row execute function update_updated_at();
create trigger workstreams_updated_at before update on workstreams
  for each row execute function update_updated_at();
create trigger entries_updated_at before update on entries
  for each row execute function update_updated_at();
create trigger users_updated_at before update on users
  for each row execute function update_updated_at();
