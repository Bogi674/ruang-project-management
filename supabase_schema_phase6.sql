-- ============================================================
-- Ruang — Phase 6: clear the Supabase database linter warnings
--
-- Additive and idempotent. Safe to run on a database that has had every
-- previous file applied, and safe to run twice. Run it in the Supabase SQL
-- editor.
--
-- Clears four of the five advisories the linter reports. The fifth — "Leaked
-- Password Protection Disabled" — is an Auth setting, not SQL; turn it on at
-- Dashboard > Authentication > Sign In / Providers > Password, under
-- "Prevent use of leaked passwords".
--
--   0011 function_search_path_mutable            public.generate_public_id
--   0011 function_search_path_mutable            public.update_updated_at
--   0028 anon_security_definer_function_...      public.handle_new_user
--   0029 authenticated_security_definer_...      public.handle_new_user
-- ============================================================

-- ── 1. Pin search_path on every function this schema owns ──────────────────
--
-- A function without a pinned search_path resolves unqualified names against
-- whatever the *caller's* path happens to be, so whoever controls that path
-- chooses which table or operator the body actually touches. It matters most
-- for SECURITY DEFINER functions, which run with the owner's rights, but the
-- linter flags all of them and pinning costs nothing.
--
-- update_updated_at() gets the strict empty path: its body calls only now(),
-- and pg_catalog is searched implicitly no matter what the setting says, so
-- there is nothing left for a path to resolve.
--
-- generate_public_id is not part of Ruang v1.0 — nothing in this repository
-- references it, and it is left over from the deprecated project-management
-- schema. Its body is therefore unknown here, so it gets `public, pg_temp`
-- rather than the empty path: that preserves whatever the function resolves
-- today instead of guessing at it. See section 3 for removing it outright.
--
-- handle_new_user() already sets `search_path = public` and fully qualifies
-- public.users, which is why the linter does not flag it. It is only in the
-- loop below for the EXECUTE revoke.

do $$
declare
  fn record;
begin
  for fn in
    -- Built from pg_get_function_identity_arguments rather than a regprocedure
    -- cast: the signature has to be schema-qualified whatever search_path the
    -- editor session happens to carry, and these functions may be overloaded.
    select format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)) as sig,
           p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('update_updated_at', 'generate_public_id', 'handle_new_user')
  loop
    if fn.proname = 'update_updated_at' then
      execute format('alter function %s set search_path = %L', fn.sig, '');
    elsif fn.proname = 'generate_public_id' then
      execute format('alter function %s set search_path = public, pg_temp', fn.sig);
    end if;

    -- ── 2. Take these functions off the public API ────────────────────────
    --
    -- Postgres grants EXECUTE on a new function to PUBLIC by default, and
    -- PostgREST exposes anything executable as /rest/v1/rpc/<name>. That is
    -- what advisories 0028 and 0029 are reporting: handle_new_user() is
    -- SECURITY DEFINER, so calling it over the REST API would run its insert
    -- with the *owner's* rights.
    --
    -- Note that phase 4's `revoke all on all functions in schema public from
    -- anon, authenticated` does not close this. The grant these roles are
    -- using is the one held by PUBLIC, and revoking from a role does not
    -- remove a privilege it inherits from PUBLIC. PUBLIC has to be named.
    --
    -- Revoking EXECUTE does not disturb the triggers. Postgres checks EXECUTE
    -- on a trigger function when the trigger is *created*, not each time it
    -- fires, so on_auth_user_created and notes_updated_at keep working.
    execute format('revoke execute on function %s from public', fn.sig);
    execute format('revoke execute on function %s from anon, authenticated', fn.sig);
  end loop;
end $$;

-- Future functions in this schema arrive without the PUBLIC grant. Applies to
-- objects created by the role running this script.
alter default privileges in schema public revoke execute on functions from public;

-- Deliberately NOT `revoke execute on all functions in schema public from
-- public`. supabase_schema.sql runs `create extension "uuid-ossp"` without a
-- target schema, so on Supabase uuid_generate_v4() can land in public — and
-- spaces.id and notes.id default to it. A blanket revoke would take EXECUTE
-- away from the role doing the inserting and break row creation. The three
-- functions named above are the ones this schema owns and the only ones the
-- linter flags.

-- ── 3. Optional: drop the deprecated function ──────────────────────────────
--
-- generate_public_id belongs to the old project-management schema. Section 1
-- silences the warning; removing the function ends it. Check for dependents
-- first — a column default or another function body would break:
--
--   select pg_get_functiondef(p.oid)
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'generate_public_id';
--
--   select a.attrelid::regclass as tbl, a.attname, d.adbin::text
--     from pg_attrdef d join pg_attribute a
--       on a.attrelid = d.adrelid and a.attnum = d.adnum
--    where pg_get_expr(d.adbin, d.adrelid) ilike '%generate_public_id%';
--
-- If both come back with nothing but the definition itself, drop it:
--
--   drop function if exists public.generate_public_id();
--
-- Use plain DROP, never DROP ... CASCADE: cascade would silently take the
-- dependents with it, which is the outcome the checks above exist to avoid.

-- ── 4. Confirm ─────────────────────────────────────────────────────────────
--
--   select p.proname, p.proconfig, p.prosecdef,
--          has_function_privilege('anon', p.oid, 'execute')          as anon_can_run,
--          has_function_privilege('authenticated', p.oid, 'execute') as user_can_run
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('update_updated_at', 'generate_public_id', 'handle_new_user');
--
-- proconfig should list a search_path for each, and both privilege columns
-- should read false. Then re-run the linter.
