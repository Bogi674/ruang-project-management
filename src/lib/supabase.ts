import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase is the database and auth provider only — never file storage.
 * File bytes live in Cloudflare R2 (see lib/r2.ts). Do not call
 * `supabase.storage` anywhere in this codebase.
 *
 * There is exactly one client factory here, and it is service-role. Two things
 * follow from that, both deliberate:
 *
 *  1. It must never reach the browser. The guard below turns a bad import into
 *     a loud failure at the point of use instead of a silent bundle that ships
 *     an admin key. (The key is not NEXT_PUBLIC_, so it would be undefined
 *     client-side anyway — but failing quietly is worse than failing.)
 *
 *  2. Service role bypasses row-level security. Every query therefore has to
 *     carry its own ownership filter (`.eq('user_id', userId)`), and a route
 *     that accepts a foreign key from the client has to verify that row
 *     belongs to the caller before writing it. RLS is not a backstop here.
 *
 * The client is constructed lazily rather than at module scope so that
 * importing this file (during a build, a lint pass, or a test) does not
 * require the environment to be populated. It is then cached for the life of
 * the process: a fresh `createClient()` per request throws away the keep-alive
 * connection pool underneath it, so every query paid a new TLS handshake to
 * Supabase. On a route that runs four or five statements that was the single
 * largest slice of the To-do page's latency.
 *
 * Caching is safe here because the client is stateless in the ways that would
 * matter — the service-role key never changes, and `persistSession` is off, so
 * there is no per-user state on it to leak between requests. Every query still
 * carries its own `user_id` filter (rule 10).
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let cached: SupabaseClient | null = null;

export function createServerClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error(
      'createServerClient() is server-only — it holds the Supabase service role key.'
    );
  }
  if (cached) return cached;
  cached = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return cached;
}
