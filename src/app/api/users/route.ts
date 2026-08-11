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

  const allowed = PREFERENCE_ENUMS[key];
  if (allowed) {
    if (value !== null && (typeof value !== 'string' || !allowed.includes(value))) {
      return `Invalid value for ${key}.`;
    }
    return null;
  }

  return null;
}

const EDITABLE = [
  'name',
  'avatar_url',
  'accent_color',
  'typography_preference',
  'surface_preference',
  'density_preference',
  'landing_page_preference',
  'theme_preference',
  'app_background_preference',
  'background_tint_preference',
];

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

  // Database messages can carry schema detail; keep them server-side.
  if (dbError) {
    console.error('[users:PATCH]', dbError.message);
    return apiError('Could not save changes', 500);
  }
  return NextResponse.json(data);
}
