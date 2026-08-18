-- ============================================================
-- Ruang — Phase 5: re-assert the appearance columns and their CHECK constraints
--
-- Additive and idempotent. Safe to run on a database that has had every
-- previous file applied, and safe to run twice. Run it in the Supabase SQL
-- editor.
--
-- WHY THIS EXISTS
--
-- Phases 3 and 4 both add the appearance CHECK constraints behind an
-- `if not exists (select 1 from pg_constraint where conname = ...)` guard. The
-- guard keys on the constraint *name*, not on what the constraint says, so a
-- database that received an earlier draft of one of those files keeps the older
-- allowed-value list forever: every later run sees the name, decides there is
-- nothing to do, and leaves the drift in place.
--
-- The drift is invisible until someone picks a value the old list does not
-- contain. Then PATCH /api/users fails with SQLSTATE 23514, the client rolls
-- the change back, and Settings shows a selector that appears to unselect
-- itself and snap to its previous option. That is the bug this file fixes.
--
-- So: drop and recreate, unconditionally, from the same value lists that
-- lib/theme.ts exports. Rows carrying a value outside the list are reset to
-- NULL first — NULL means "not chosen", which resolveTheme() reads as the
-- default — because ADD CONSTRAINT is validated against existing rows and
-- would otherwise abort on the very rows it is meant to describe.
--
-- Keep the lists below in step with APP_BACKGROUND_VALUES,
-- BACKGROUND_TINT_VALUES and THEME_VALUES in src/lib/theme.ts.
-- ============================================================

-- ── 1. Columns ─────────────────────────────────────────────────────────────
--
-- Repeated from phase 4 so this file is sufficient on its own. A missing
-- preference column is not cosmetic: PostgREST fails a SELECT as a whole when
-- one column in it is unknown, which made the server read no preferences at all
-- and dark mode revert to light on every load.

alter table public.users
  add column if not exists accent_color               text,
  add column if not exists typography_preference      text,
  add column if not exists surface_preference         text,
  add column if not exists density_preference         text,
  add column if not exists landing_page_preference    text,
  add column if not exists theme_preference           text,
  add column if not exists app_background_preference  text,
  add column if not exists background_tint_preference text;

-- ── 2. Normalise any value the app can no longer produce ───────────────────

update public.users
   set theme_preference = 'light'
 where theme_preference is not null
   and theme_preference not in ('light', 'dark');

update public.users
   set app_background_preference = null
 where app_background_preference is not null
   and app_background_preference not in
       ('plain', 'dots', 'grid', 'diagonal', 'waves', 'glow');

update public.users
   set background_tint_preference = null
 where background_tint_preference is not null
   and background_tint_preference not in
       ('neutral', 'warm', 'cool', 'mint', 'blush', 'accent');

-- ── 3. Rebuild the constraints from the current lists ──────────────────────

alter table public.users
  drop constraint if exists users_theme_preference_check,
  drop constraint if exists users_app_background_preference_check,
  drop constraint if exists users_background_tint_preference_check;

alter table public.users
  add constraint users_theme_preference_check
    check (theme_preference is null or theme_preference in ('light', 'dark')),

  add constraint users_app_background_preference_check
    check (app_background_preference is null or app_background_preference in
      ('plain', 'dots', 'grid', 'diagonal', 'waves', 'glow')),

  add constraint users_background_tint_preference_check
    check (background_tint_preference is null or background_tint_preference in
      ('neutral', 'warm', 'cool', 'mint', 'blush', 'accent'));

-- ── 4. Confirm ─────────────────────────────────────────────────────────────
--
-- Run this afterwards; each row should list exactly the values above.
--
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.users'::regclass
--      and contype = 'c'
--    order by conname;
--
-- PostgREST caches the table schema. If a write still fails with a "column not
-- found in the schema cache" error after this runs, reload it with:
--
--   notify pgrst, 'reload schema';
