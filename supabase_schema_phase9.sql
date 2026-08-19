-- ═══════════════════════════════════════════════════════════════════════════
-- Ruang — phase 9: colour schemes
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Additive and idempotent. One nullable column on `users`, with a CHECK whose
-- allowed list mirrors `COLOR_SCHEMES` in `lib/theme.ts`.
--
-- Run it after phase 7. Order against phase 8 does not matter.
--
-- ── The constraint is dropped and recreated, never guarded ─────────────────
--
-- Phases 3 and 4 guarded `add constraint` with a check on `pg_constraint.conname`,
-- which keys on the constraint's *name* rather than on what it says. A database
-- that received an earlier draft therefore kept the older allowed-value list
-- forever, and every later run decided there was nothing to do. Phase 5 fixed
-- that family of bugs by dropping and recreating instead, and this file follows
-- the same rule.
--
-- The same obligation applies going forward: **adding a fifth scheme to
-- `COLOR_SCHEMES` needs a new migration that drops and recreates this
-- constraint.** An `if not exists` guard will silently skip it, the app will
-- offer the new scheme, and picking it will fail the write with a constraint
-- violation that surfaces in Settings as a card that unselects itself.
--
-- ── Why null rather than 'calm' ────────────────────────────────────────────
--
-- Null means "never chosen", which `resolveTheme` resolves to `calm`. Writing
-- 'calm' as a column default would make every existing row look like a
-- deliberate choice, and there would be no way to tell a user who picked the
-- original palette from one who has never opened Settings — the same reasoning
-- as every other preference column in this schema.
--
-- ── What could NOT be verified ─────────────────────────────────────────────
--
-- The live database is unreachable from the environment this was written in:
-- the sandbox's network policy blocks `*.supabase.co`, so this was not run
-- against the real project and the column is not known to exist there yet.
-- Until it does, `/api/users` will reject a scheme change with the
-- "column not found in the schema cache" message the route already translates,
-- and the root layout's tier fallback keeps every other preference working —
-- see the tiering comment in `src/app/layout.tsx`.

alter table public.users
  add column if not exists color_scheme text;

-- `add constraint` validates existing rows, so anything outside the current
-- list goes back to NULL first or the ALTER fails outright on a drifted
-- database.
update public.users set color_scheme = null
 where color_scheme is not null
   and color_scheme not in ('calm', 'indigo', 'citrus', 'emerald', 'dusk');

alter table public.users
  drop constraint if exists users_color_scheme_check;

alter table public.users
  add constraint users_color_scheme_check
    check (color_scheme is null or color_scheme in ('calm', 'indigo', 'citrus', 'emerald', 'dusk'));

-- ── Confirm ────────────────────────────────────────────────────────────────
--
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'users'
--      and column_name = 'color_scheme';
--
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid = 'public.users'::regclass
--      and conname = 'users_color_scheme_check';
--
-- PostgREST caches the schema. If Settings reports that the scheme could not be
-- saved straight after this runs, reload it:
--
--   notify pgrst, 'reload schema';
