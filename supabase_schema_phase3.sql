-- Ruang — Phase 3 schema (additive, idempotent; safe to re-run)
--
-- Adds the two appearance columns behind the app-background customisation:
--   app_background_preference  — the background graphic on the app canvas
--   background_tint_preference — the canvas colour behind cards
--
-- Both are nullable. NULL means "not chosen", which resolveTheme() reads as
-- 'plain' / 'neutral'. Existing rows therefore keep the current look.

alter table public.users
  add column if not exists app_background_preference text,
  add column if not exists background_tint_preference text;

-- The API validates these too, but a CHECK keeps the invariant with the data
-- rather than only with the code path that happens to write it today.
do $$
begin
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
