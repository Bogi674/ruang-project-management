import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/api-helpers';
import { createServerClient } from '@/lib/supabase';
import { PREFERENCE_ENUMS, HEX_COLOR } from '@/lib/theme';

export async function GET() {
  const { error, userId } = await requireAuth();
  if (error) return error;

  const db = createServerClient();
  const { data, error: dbError } = await db.from('users').select('*').eq('id', userId!).single();
  if (dbError || !data) return apiError('Not found', 404);
  return NextResponse.json(data);
}

const MAX_NAME_LENGTH = 80;
/** Avatars are stored as data URLs, so the column is a real write target. */
const MAX_AVATAR_LENGTH = 3 * 1024 * 1024;
const AVATAR_DATA_URL = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+/=\s]+$/;

/**
 * Validates one field. Returning a string rejects the request.
 *
 * Every value here ends up either rendered into the page or written straight
 * onto <html> as an attribute or a CSS custom property, so "the client only
 * ever sends good values" is not a safe assumption — the API is the boundary.
 */
function validate(key: string, value: unknown): string | null {
  if (key === 'name') {
    if (typeof value !== 'string' || !value.trim()) return 'Display name cannot be empty.';
    if (value.length > MAX_NAME_LENGTH) return 'Display name is too long.';
    return null;
  }

  if (key === 'avatar_url') {
    if (value === null || value === '') return null;
    if (typeof value !== 'string') return 'Invalid avatar.';
    if (value.length > MAX_AVATAR_LENGTH) return 'Avatar image is too large.';
    // Only inline images and https URLs — no javascript:, data:text/html, or
    // other schemes that would be handed to an <img src> or a CSS url().
    if (value.startsWith('data:')) {
      if (!AVATAR_DATA_URL.test(value)) return 'Invalid avatar.';
      return null;
    }
    if (!/^https:\/\//i.test(value)) return 'Invalid avatar.';
    return null;
  }

  if (key === 'accent_color') {
    // Written into a CSS custom property; anything but a literal hex is out.
    if (value !== null && (typeof value !== 'string' || !HEX_COLOR.test(value))) {
      return 'Invalid accent colour.';
    }
    return null;
  }

  // To-do settings. Unlike the appearance columns these are not all strings,
  // so they cannot ride in PREFERENCE_ENUMS — but they reach the same CHECK
  // constraints, and a value the database rejects surfaces as a setting that
  // silently snaps back, so they are validated just as strictly.
  if (TODO_BOOLEAN_KEYS.includes(key)) {
    if (value !== null && typeof value !== 'boolean') return `Invalid value for ${key}.`;
    return null;
  }

  if (key === 'todo_today_cap') {
    // 0 is the off switch the toggle writes; the constraint allows 1–50, so
    // "no cap" has to be stored as null rather than 0.
    if (value === null) return null;
    if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 50) {
      return 'The Today cap has to be between 1 and 50.';
    }
    return null;
  }

  const allowed = PREFERENCE_ENUMS[key] ?? TODO_PREFERENCE_ENUMS[key];
  if (allowed) {
    if (value !== null && (typeof value !== 'string' || !allowed.includes(value))) {
      return `Invalid value for ${key}.`;
    }
    return null;
  }

  return null;
}

const TODO_BOOLEAN_KEYS = ['todo_show_estimates', 'todo_show_progress', 'todo_rollover'];

const TODO_PREFERENCE_ENUMS: Record<string, readonly string[]> = {
  todo_default_assignment: ['today', 'unassigned'],
  todo_done_behavior: ['stay', 'section'],
  todo_subtask_mode: ['independent', 'dependent'],
};

const EDITABLE = [
  'name',
  'avatar_url',
  'accent_color',
  'typography_preference',
  'surface_preference',
  'density_preference',
  'landing_page_preference',
  'theme_preference',
  'color_scheme',
  'app_background_preference',
  'background_tint_preference',
  'todo_default_assignment',
  'todo_done_behavior',
  'todo_subtask_mode',
  'todo_show_estimates',
  'todo_show_progress',
  'todo_today_cap',
  'todo_rollover',
];

/**
 * Turns a database failure into something the person in Settings can act on.
 *
 * These are the ways a preference write fails when the code is correct and the
 * database has drifted: a column the app knows about that the database has not
 * been migrated for, or a CHECK constraint whose allowed list is older than the
 * enums in `lib/theme.ts`. Both present identically in the UI — the setting
 * applies, then rolls back — so the reason has to travel to the client.
 *
 * Only the SQLSTATE travels, never the message: codes are a fixed public
 * vocabulary, messages quote column and constraint names.
 */
function saveFailureReason(dbError: { code?: string; message?: string }, keys: string[]): string {
  // Which file to run depends on which columns the request carried: the
  // appearance columns arrived in phase 5, the to-do settings in phase 7.
  const file = keys.some((k) => k.startsWith('todo_'))
    ? 'supabase_schema_phase7.sql'
    : 'supabase_schema_phase5.sql';

  switch (dbError.code) {
    // undefined_column, and PostgREST's equivalent when the column is missing
    // from its cached schema.
    case '42703':
    case 'PGRST204':
      return `this database has no column for that setting yet — run ${file}.`;
    case '23514': // check_violation
      return `the database rejected that value — its allowed list is out of date. Run ${file}.`;
    case '23502': // not_null_violation
      return 'the database will not accept an empty value for that setting.';
    case 'PGRST116': // no row matched the filter
      return 'your account record could not be found.';
    default:
      return `the database refused the write (${dbError.code || 'no code'}).`;
  }
}

export async function PATCH(req: NextRequest) {
  const { error, userId } = await requireAuth();
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return apiError('Invalid JSON body', 400);
  }
  if (!body || typeof body !== 'object') return apiError('Invalid body', 400);

  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (!(key in body)) continue;
    const problem = validate(key, body[key]);
    if (problem) return apiError(problem, 400);
    updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) return apiError('Nothing to update', 400);

  const db = createServerClient();
  const { data, error: dbError } = await db
    .from('users')
    .update(updates)
    .eq('id', userId!)
    .select()
    .single();

  if (dbError) {
    // The raw message can carry schema detail, so it stays in the server log.
    // The code does not, and it is the difference between "this is broken" and
    // "run the migration" — a rejected write here is otherwise invisible to the
    // user as a setting that silently snaps back to its old value.
    console.error('[users:PATCH]', dbError.code, dbError.message, Object.keys(updates).join(','));
    return apiError(saveFailureReason(dbError, Object.keys(updates)), 500);
  }
  return NextResponse.json(data);
}
