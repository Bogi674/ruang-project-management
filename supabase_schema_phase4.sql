-- ============================================================
-- Ruang — Phase 4: hardening + preference-column backfill
--
-- Additive and idempotent. Safe to run on a database that has had every
-- previous file applied, and safe to run twice.
--
-- Run this in the Supabase SQL editor. It does three things:
--
--   1. Guarantees every appearance column exists. A missing column is not a
--      cosmetic problem: PostgREST fails a SELECT as a whole when one column
--      in it is unknown, so an un-migrated database made the root layout read
--      *no* preferences at all — and dark mode reverted to light on every
--      load.
--
--   2. Asserts row-level security is on for every application table.
--
--   3. Takes the `anon` and `authenticated` Postgres roles off the public
--      schema entirely. This is the one that matters for going public: those
--      two roles are what the *publishable* Supabase keys map to, and anyone
--      who has your project URL can call PostgREST with them. Ruang never uses
--      them — every query in the app goes through the service role from a
--      server route — so removing the grants costs nothing here and turns the
--      public API surface off rather than relying on policy evaluation to keep
--      it shut.
--
-- What this does NOT do, and cannot: it does not stop *you* reading the data.
-- The service-role key and the Supabase dashboard are project-owner access by
-- definition. Passwords are not in reach either way — they live in
-- auth.users.encrypted_password as bcrypt hashes, managed by Supabase, and no
-- application query touches that table.
-- ============================================================

-- ── 1. Appearance columns (mirrors phase 2 + phase 3, in one place) ─────────

alter table public.users
  add column if not exists accent_color               text,
  add column if not exists typography_preference      text,
  add column if not exists surface_preference         text,
  add column if not exists density_preference         text,
  add column if not exists landing_page_preference    text,
  add column if not exists theme_preference           text,
  add column if not exists app_background_preference  text,
  add column if not exists background_tint_preference text;

alter table public.notes
  add column if not exists is_locked boolean not null default false;

-- Any row still carrying the retired 'system' theme reads as Light in the app.
-- This has to run *before* the CHECK below, or adding the constraint fails on
-- the rows it is meant to describe.
update public.users
   set theme_preference = 'light'
 where theme_preference is not null
   and theme_preference not in ('light', 'dark');

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_theme_preference_check'
  ) then
    alter table public.users
      add constraint users_theme_preference_check
      check (theme_preference is null or theme_preference in ('light', 'dark'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'users_app_background_preference_check'
  ) then
    alter table public.users
      add constraint users_app_background_preference_check
      check (app_background_preference is null or app_background_preference in
        ('plain', 'dots', 'grid', 'diagonal', 'waves', 'glow'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'users_background_tint_preference_check'
  ) then
    alter table public.users
      add constraint users_background_tint_preference_check
      check (background_tint_preference is null or background_tint_preference in
        ('neutral', 'warm', 'cool', 'mint', 'blush', 'accent'));
  end if;
end $$;

-- ── 2. Row-level security on every application table ───────────────────────
--
-- The policies themselves live in supabase_schema.sql. This only asserts that
-- enforcement is switched on, so that if the app ever moves off the service
-- role (the recommended direction — see SECURITY_REVIEW.md) the policies are
-- already live rather than needing to be remembered.

do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'spaces', 'notes', 'note_versions', 'widgets', 'files',
    'reminder_deliveries', 'notifications'
  ] loop
    if exists (
      select 1 from information_schema.tables
       where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- ── 3. Close the public PostgREST surface ──────────────────────────────────
--
-- Reversible: if you later add a browser Supabase client, grant back exactly
-- the tables it needs and rely on the RLS policies from there.

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
revoke usage on schema public from anon, authenticated;

-- Future tables inherit the same posture instead of arriving open. Applies to
-- objects created by the role running this script; re-run it after a migration
-- that creates tables as a different owner.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- handle_new_user() is SECURITY DEFINER and fires from a trigger on
-- auth.users, which the Supabase auth role owns — the revokes above do not
-- affect it. Confirm after running:
--
--   select rolname, has_schema_privilege(rolname, 'public', 'usage')
--     from pg_roles where rolname in ('anon', 'authenticated');
--
-- Both should report false.
