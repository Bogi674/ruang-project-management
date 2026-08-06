-- Ruang v1.0 Schema
-- Run this in Supabase SQL Editor

create extension if not exists "uuid-ossp";

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text not null,
  avatar_url text,
  accent_color text,
  typography_preference text,
  surface_preference text,
  density_preference text,
  landing_page_preference text,
  theme_preference text,
  created_at timestamptz default now()
);

create table if not exists spaces (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  color text not null default '#738290',
  icon text,
  owner_id uuid not null references users(id) on delete cascade,
  parent_id uuid references spaces(id) on delete cascade,
  path text not null,
  depth int not null default 0 check (depth between 0 and 2),
  is_shared boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists spaces_owner_id_idx on spaces(owner_id);
create index if not exists spaces_parent_id_idx on spaces(parent_id);

create table if not exists notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null default 'note' check (type in ('note', 'checklist')),
  title text,
  content jsonb,
  space_id uuid references spaces(id) on delete set null,
  tags jsonb not null default '[]',
  pinned_date date,
  pinned_date_end date,
  is_pinned_to_home boolean not null default false,
  is_public boolean not null default false,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists notes_user_id_idx on notes(user_id);
create index if not exists notes_space_id_idx on notes(space_id);
create index if not exists notes_updated_at_idx on notes(updated_at desc);
create index if not exists notes_pinned_date_idx on notes(pinned_date) where pinned_date is not null;
create index if not exists notes_title_gin_idx on notes using gin(to_tsvector('english', coalesce(title, '')));

create table if not exists widgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  note_id uuid references notes(id) on delete cascade,
  type text not null check (type in ('reminder', 'file', 'link')),
  content jsonb not null default '{}',
  created_at timestamptz default now()
);

create index if not exists widgets_user_id_idx on widgets(user_id);
create index if not exists widgets_note_id_idx on widgets(note_id);

create table if not exists files (
  id uuid primary key default uuid_generate_v4(),
  widget_id uuid not null references widgets(id) on delete cascade,
  uploaded_by uuid not null references users(id) on delete cascade,
  filename text not null,
  r2_object_key text not null unique,
  r2_bucket text not null,
  mime_type text not null,
  size_bytes bigint not null default 0,
  created_at timestamptz default now()
);

create table if not exists reminder_deliveries (
  id uuid primary key default uuid_generate_v4(),
  widget_id uuid not null references widgets(id) on delete cascade,
  recipient_id uuid not null references users(id) on delete cascade,
  channel text not null default 'email',
  status text not null default 'pending',
  scheduled_at timestamptz,
  sent_at timestamptz,
  error_message text
);

create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  recipient_id uuid not null references users(id) on delete cascade,
  actor_id uuid references users(id) on delete set null,
  type text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz default now()
);

create index if not exists notifications_recipient_id_idx on notifications(recipient_id);
create index if not exists notifications_is_read_idx on notifications(recipient_id, is_read) where is_read = false;

alter table users enable row level security;
alter table spaces enable row level security;
alter table notes enable row level security;
alter table widgets enable row level security;
alter table files enable row level security;
alter table notifications enable row level security;

create policy "users_own" on users for all using (auth.uid() = id);
create policy "spaces_owner" on spaces for all using (auth.uid() = owner_id);
create policy "notes_owner" on notes for all using (auth.uid() = user_id);
create policy "widgets_owner" on widgets for all using (auth.uid() = user_id);
create policy "files_owner" on files for all using (auth.uid() = uploaded_by);
create policy "notifications_recipient" on notifications for all using (auth.uid() = recipient_id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
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

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_updated_at on notes;
create trigger notes_updated_at
  before update on notes
  for each row execute procedure update_updated_at();
