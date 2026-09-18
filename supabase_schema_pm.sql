-- PM Phase 1 Schema
-- Projects, Workstreams, Entries

create table if not exists projects (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references users(id) on delete cascade,
  name        text        not null,
  color       text        not null default '#A1B5D8',
  status      text        not null default 'todo' check (status in ('todo', 'in_progress', 'on_hold', 'completed')),
  description text,
  start_date  date,
  end_date    date,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists projects_user_id_idx on projects(user_id);

create table if not exists workstreams (
  id          uuid        primary key default uuid_generate_v4(),
  project_id  uuid        not null references projects(id) on delete cascade,
  user_id     uuid        not null references users(id) on delete cascade,
  name        text        not null,
  color       text        not null default '#A1B5D8',
  position    double precision not null default 0,
  created_at  timestamptz default now()
);

create index if not exists workstreams_project_id_idx on workstreams(project_id);

create table if not exists project_entries (
  id               uuid        primary key default uuid_generate_v4(),
  project_id       uuid        not null references projects(id) on delete cascade,
  workstream_id    uuid        references workstreams(id) on delete set null,
  user_id          uuid        not null references users(id) on delete cascade,
  type             text        not null check (type in ('note', 'file', 'task', 'reminder', 'link')),
  title            text        not null default '',
  content          jsonb,
  status           text        check (status in ('todo', 'in_progress', 'blocked', 'done')),
  pinned_date      date,
  pinned_date_end  date,
  position         double precision not null default 0,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists project_entries_project_id_idx    on project_entries(project_id);
create index if not exists project_entries_workstream_id_idx on project_entries(workstream_id);
create index if not exists project_entries_user_id_idx       on project_entries(user_id);

-- RLS
alter table projects        enable row level security;
alter table workstreams     enable row level security;
alter table project_entries enable row level security;

-- All RLS policies (service role bypasses these; included for completeness)
create policy if not exists "projects_owner" on projects
  for all using (user_id = auth.uid());

create policy if not exists "workstreams_owner" on workstreams
  for all using (user_id = auth.uid());

create policy if not exists "project_entries_owner" on project_entries
  for all using (user_id = auth.uid());

-- Updated_at trigger for projects
create or replace function update_projects_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function update_projects_updated_at() from public;

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at
  before update on projects
  for each row execute function update_projects_updated_at();

-- Updated_at trigger for project_entries
create or replace function update_project_entries_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke execute on function update_project_entries_updated_at() from public;

drop trigger if exists project_entries_updated_at on project_entries;
create trigger project_entries_updated_at
  before update on project_entries
  for each row execute function update_project_entries_updated_at();
