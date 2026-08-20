-- Phase 10: Make widget_id nullable in files table to support direct todo file attachments.
--
-- Previously every file row required a widget_id FK. Todo attachments need to reference
-- files directly (via todo_attachments.file_id) without going through a widget, so
-- widget_id becomes optional. The NOT NULL constraint on files.widget_id is dropped
-- and replaced with a CHECK that at least one of widget_id or a todo_attachment references
-- this file. Since enforcing that cross-table invariant in SQL is complex, we instead
-- just drop the NOT NULL and let the application layer ensure files are always either
-- linked to a widget or a todo_attachment.
--
-- Idempotent (safe to re-run).

DO $$
BEGIN
  -- Drop NOT NULL on widget_id only if it is currently NOT NULL
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'files'
      AND column_name = 'widget_id'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.files ALTER COLUMN widget_id DROP NOT NULL;
  END IF;
END $$;
