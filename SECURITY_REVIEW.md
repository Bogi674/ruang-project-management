# Ruang — Security Review

Review date: 2026-08-11 · Scope: full application (auth, API routes, storage,
headers, client, dependencies) at commit `4d8d346`.

Findings are ordered by what an attacker could actually do. Each says whether
it is **fixed in this change** or **outstanding** with the recommended action.

---

## The structural issue everything else follows from

**Every database query runs as the Supabase service role, which bypasses
row-level security.**

`supabase_schema.sql` defines a complete, correct set of RLS policies —
`notes: select own`, `widgets: update own`, and so on for every table. None of
them ever execute. `lib/supabase.ts` exposes a single client built from
`SUPABASE_SERVICE_ROLE_KEY`, and that is what all 19 API routes and all 8
server pages use.

The consequence: **a missing `.eq()` filter is a full cross-tenant data breach,
with nothing behind it to catch the mistake.** That is not hypothetical — four
of the findings below are exactly that mistake, in four different routes.

Nothing in this change alters that architecture; doing so is a project of its
own. What this change does is (a) fix every instance found, (b) add
`lib/ownership.ts` so the check is a named, reusable call rather than something
each route remembers to inline, and (c) document the constraint at the top of
`lib/supabase.ts` so the next route written inherits the context.

**Recommended action (high value, medium effort).** Move user-scoped reads and
writes onto a request-scoped client that carries the user's identity, so RLS
becomes live instead of decorative. Practically: mint a Supabase JWT for the
signed-in user (or move to `@supabase/ssr` with Supabase Auth sessions) and use
the anon-key client for user data, reserving the service role for genuine admin
operations — `auth.admin.createUser`, the reminder-delivery worker. Even a
partial migration is worth it: after it, a forgotten filter returns zero rows
instead of somebody else's notes.

---

## 1. Cross-tenant writes via unverified foreign keys — **fixed**

Four routes accepted an id from the request body and used it without checking
who owned it. The row-level `user_id` filter does not help here: the row being
written *is* yours, the reference in it is not.

| Route | Field | What it allowed |
|---|---|---|
| `POST /api/widgets` | `note_id` | Attach a widget to **another user's note**. The victim's note GET returns `widgets(*)`, so injected content renders inside their note as their own attachment — a phishing surface (a "link" widget pointing anywhere, presented as something they saved). |
| `POST /api/files` | `widget_id` | Attach a file record to another user's widget. |
| `POST /api/files` | `r2_object_key` | **The worst of the four.** The key was stored verbatim, and `GET /api/files/[id]` only checks that the *row* belongs to the caller — never the key. Pointing your own file row at any object key in the bucket therefore minted a valid signed read URL for it. Guessing a key requires a UUID, so this was not trivially exploitable, but it was an arbitrary-object read primitive with no ownership check anywhere in the path. |
| `POST /api/spaces` | `parent_id` | Nest a space under someone else's. The response includes the materialised `path`, which is built from the parent chain — so the response leaked another account's space names. |
| `PATCH /api/notes/[id]` | `space_id` | Point your note at another user's space; the note chip then renders that space's name and colour. |

**Fixed:** all five now resolve the reference through `ownsNote` / `ownsWidget`
/ `ownsSpace` in `lib/ownership.ts` and return 404 when it is not the caller's.
`r2_object_key` must additionally start with `${userId}/`, which is the prefix
`/api/files/upload-url` issues under.

## 2. Object-key path traversal in upload URLs — **fixed**

`GET /api/files/upload-url` built the key as
`${userId}/${uuid}/${filename}` with `filename` taken raw from the query
string. A filename of `../../victim/…` walked straight out of the per-user
prefix — which is the same prefix finding 1 now relies on. Filenames are now
reduced to a basename over a conservative character set with control
characters and leading dots stripped.

## 3. Stored files could be served as active content — **fixed**

`contentType` was passed through to the presigned PUT unfiltered, and the
signed GET inherited whatever Content-Type was stored. Uploading `text/html`
or an SVG and opening it gave attacker-controlled markup executing on the R2
origin. Now: risky types are coerced to `application/octet-stream` at upload,
and downloads override the response headers — images, PDF and plain text still
preview inline, everything else is forced to `attachment`.

## 4. SSRF: the host allowlist was bypassable by redirect — **fixed**

`GET /api/links/preview` validated the submitted hostname against a private-range
blocklist and then called `fetch(..., { redirect: 'follow' })`. Any public URL
the attacker controls could answer `302 Location: http://169.254.169.254/…`
and fetch would follow it into the cloud metadata service. The blocklist was
also incomplete (no CGNAT, no IPv6 ULA, no IPv4-mapped IPv6).

**Fixed:** redirects are followed manually with each hop re-validated, capped
at 4; the blocklist covers CGNAT, multicast, IPv6 unique-local/link-local and
both spellings of IPv4-mapped IPv6; hostnames are DNS-resolved and every
returned address is checked, which closes the "public hostname with a private
A record" bypass; `og:image` is re-validated against the same rules before it
is stored and later rendered in an `<img>`; and the route is rate limited.

**Residual risk (accepted, documented in the route):** DNS rebinding between
the lookup and the socket is still possible. Closing it needs a custom agent
that connects to the pinned address, or an egress proxy. Given the route only
reads `<head>` and returns four fields, the exposure is low.

## 5. PostgREST filter injection in search — **fixed**

`/search` built its filter by string concatenation:
`.or(\`title.ilike.%${query}%\`)`. A query containing a comma or parenthesis
injected additional filter terms into the expression. The `user_id` equality is
ANDed separately so this could not read another user's notes, but it could
provoke errors and reference unintended columns. Replaced with a parameterised
`.ilike()`, with LIKE metacharacters escaped so a typed `%` stays literal.

## 6. Account takeover via unverified registration — **OUTSTANDING (highest priority)**

`POST /api/auth/register` creates the account with `email_confirm: true` and
never sends a verification mail. Anyone can register `victim@example.com`.

That alone is bad. It becomes takeover because of `signIn` in `lib/auth.ts`:
when someone signs in with Google, the callback looks up `users` **by email
address** and adopts the existing row. So:

1. Attacker registers `victim@example.com` with a password they choose.
2. Victim later signs in with Google, same address.
3. The callback finds the pre-registered row and logs the victim into it.
4. The attacker still knows the password — and now has the victim's notes.

**Partially mitigated in this change:** registration is rate limited (5 per 15
min per IP); the account-exists response is now identical to the success
response, so the endpoint is no longer an email-enumeration oracle; and Google
sign-in is refused when the provider reports `email_verified: false`.

**The actual fix is still needed.** Verify the address at registration —
either switch the route to `db.auth.signUp()` (Supabase mails the confirmation
link) and add a "check your email" state to `/signup`, or keep
`admin.createUser` with `email_confirm: false` and call
`auth.admin.generateLink({ type: 'signup' })` yourself. This changes the signup
UX, which is why it is not done here. Until it ships, treat Google-to-password
account linking as untrusted.

## 7. No rate limiting on authentication — **partially fixed**

The credentials login, registration and password change accepted unlimited
attempts. Added: 10 login attempts per 15 min keyed on both source IP and
target email; 5 registrations per 15 min; 5 password changes per 15 min; 30
link previews per minute; 20 reminder sends per hour.

**Caveat you need to know about:** `lib/ratelimit.ts` is in-memory and
per-instance. On Vercel that means the real limit is `limit × live instances`
and it resets on cold start. It is a speed bump, not a control. **Recommended
action:** move the counter to Vercel KV or Upstash Redis — only `hit()` changes,
every call site stays as-is.

## 8. Password change does not revoke existing sessions — **OUTSTANDING**

Sessions are stateless JWTs (`session: { strategy: 'jwt' }`). Changing the
password updates the Supabase credential but every already-issued token stays
valid until it expires — so "change my password because I think someone has
access" does not actually lock the attacker out.

**Recommended action:** add a `token_version` integer to `users`, put it in the
JWT in the `jwt` callback, compare it on each request, and bump it on password
change. Alternatively switch to a database session strategy.

## 9. Missing security headers — **fixed**

Only `X-Content-Type-Options` and `X-Frame-Options` were set. Added a
Content-Security-Policy (`frame-ancestors 'none'`, `base-uri 'self'`,
`form-action 'self'`, `object-src 'none'`, and an explicit connect/img
allowlist), `Referrer-Policy: strict-origin-when-cross-origin` (note ids and
search terms are in URLs), `Permissions-Policy`, `Cross-Origin-Opener-Policy`,
HSTS, `Cache-Control: no-store` on `/api/*`, and `poweredByHeader: false`.

The CSP keeps `'unsafe-inline'` on both `script-src` and `style-src` — Next 14's
App Router inlines its bootstrap without a nonce, and the theme layer sets CSS
custom properties through React `style` props. **Recommended action:** adopt
Next's nonce-based CSP via middleware when you next touch the framework
version; the other directives are doing real work in the meantime.

## 10. Unvalidated input written into the DOM and into CSS — **fixed**

`PATCH /api/users` accepted any value for any allowlisted column. Those values
are then written onto `<html>` as attributes (`data-density`) and as CSS custom
properties (`--accent-blue`). `setAttribute` does not execute, so this was
self-inflicted at worst, but `accent_color` flowed unchecked into
`style.setProperty` — CSS injection into your own page.

`avatar_url` was the more concrete problem: unbounded length (avatars are
stored as base64 data URLs, so this is a real write path) and no scheme check.

**Fixed:** every preference is validated against its enum, `accent_color`
against `/^#[0-9a-f]{6}$/`, `avatar_url` against an image data-URL pattern or
an `https:` URL with a 3 MB ceiling. Space names, colours and icons, note
titles, tags and dates are validated too; note and widget payloads have size
ceilings (2 MB / 256 KB) so autosave cannot be used to fill the database.

## 11. Database error messages returned to clients — **fixed**

Routes returned `dbError.message` verbatim, which leaks column names,
constraint names and query structure. All now log server-side and return a
generic message.

## 12. Service-role clients constructed at module scope — **fixed**

`lib/supabase.ts` exported `supabase` and `supabaseAdmin` as module-level
constants. Neither was used anywhere. The service key is not `NEXT_PUBLIC_`, so
it would have been `undefined` in a browser bundle rather than leaked — but a
module-scope admin client is a trap for whoever next imports the file from a
client component. Both exports are gone; `createServerClient()` builds lazily
and throws if called in a browser.

## 13. Email HTML injection — **fixed**

`lib/resend.ts` interpolated the reminder title and note title into the email
body unescaped, and into the `Subject` header unfiltered. Today the only
recipient is the author, so the blast radius is your own inbox — but
`ReminderForm` already collects a `recipients` list, and the moment that
delivery path ships this becomes markup you can inject into someone else's
mail. Escaped now, with CRLF stripped from the subject. Also removed a
module-scope `throw` on missing `RESEND_API_KEY` that took down every route
transitively importing the file.

## 14. Dependencies — **partially fixed**

`postcss` bumped to 8.5.26 (the direct dependency; a 8.4.31 copy remains
vendored inside Next).

**`next@14.2.35` is outstanding and is the largest remaining item.** It carries
21 advisories, and **there is no patched 14.x** — 14.2.35 is the final release
of the line. The fix is Next 15.5.23 (backport) or 16.3.0.

Most of the 21 do not apply to this app: there is no middleware, no i18n, no
Server Actions, no custom server, and Vercel's edge handles image optimisation.
The ones worth weighing are the cache-poisoning and cache-confusion advisories
on RSC responses, which do apply to an App Router app.

**Recommended action:** plan the upgrade to Next 15.5.x. It is not a drop-in —
`params` and `searchParams` become Promises in 15, which touches every dynamic
page and route handler in this repo (roughly a dozen files, mechanical). Do it
as its own change with the app running in front of you, not bundled with
feature work.

`glob` (high, command injection) is dev-only via `eslint-config-next` and is
not reachable at runtime.

## 15. Avatars stored as base64 in Postgres — **OUTSTANDING (architecture)**

`ProfileTab` reads the selected image with `FileReader.readAsDataURL` and
PATCHes the whole data URL into `users.avatar_url`. This contradicts the
project's own rule — *all file bytes go to R2, never anywhere else* — and it
means a ~1.4 MB string is read on every request that selects the user row.

Size is now capped at 3 MB server-side and the format validated, so it is no
longer an unbounded write. **Recommended action:** route avatars through the
existing R2 upload flow and store the object key, the same as every other file.

## 16. Smaller items — **fixed**

- Path parameters were passed to Postgres without a UUID shape check, so a
  malformed id produced a 500 with a database error rather than a 404.
- `PATCH /api/notes/[id]` accepted an `avatar_url` field copied from the users
  route. The `notes` table has no such column, so sending it produced a 500.
- `DELETE /api/files/[id]` re-queried by id alone on the delete after checking
  ownership on the select. Now scoped on both.
- `GET /api/notes?count=true` ignored `space_id` and always counted storeroom
  notes, so a space's badge showed the wrong number.
- Malformed JSON bodies threw instead of returning 400.

---

## What to do next, in order

1. **Verify email addresses at registration** (finding 6). This is the only
   finding that leads to full account takeover, and the mitigations shipped
   here narrow it without closing it.
2. **Move rate limiting to shared storage** (finding 7). Small change, and it
   turns a speed bump into an actual control.
3. **Plan the Next.js upgrade to 15.5.x** (finding 14). Mechanical but
   wide-reaching; give it its own change.
4. **Revoke sessions on password change** (finding 8).
5. **Migrate user-scoped queries off the service role so RLS is live** (the
   structural issue). The largest item and the one that stops this class of bug
   recurring.
6. **Move avatars to R2** (finding 15).
