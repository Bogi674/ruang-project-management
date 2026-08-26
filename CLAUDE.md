# Ruang v1.7 — Claude Code Context File

> Read this at the start of every session. This is the source of truth for architecture,
> design decisions, and critical rules. Visual source of truth: `Ruang_Prototype_dc.html`
> (desktop) and `Ruang_Mobile_dc.html` (mobile). When in doubt, match the prototype exactly.

---

## What This Is

**Ruang** (Indonesian for "space" or "room") is a note-first personal workspace web app.

**Core promise:** Open the app, start writing. Nothing mandatory. Organize when you feel like it.

**Previous version deprecated.** The old project-management version (Platform > Project > Workstream > Entry)
is fully deprecated. This is a clean rebuild with a fundamentally different architecture.
Do not reference old schema, old routes, or old component structure.

**Target platform:** Desktop-first (min 1024px). PWA-installable on mobile (390px target).

---

## Version History

A chronological record of every meaningful iteration from the first commit to the current state.
For the full narrative see `README.md`; this section is the quick reference.

### Legacy — Old PM Tool *(deprecated, before Aug 2026)*

Four-level hierarchy: **Platform → Project → Workstream → Entry**. Traditional sidebar, project boards, structured task tracking. Deprecated in its entirety. No code from this version survives. Do not reference its schema, routes, or component names.

### v1.0 — Core Ruang Rebuild *(Aug 6–7, 2026)*

Clean-slate rebuild as a note-first workspace. All old PM code removed.

- **Schema:** `supabase_schema.sql` — `users`, `spaces`, `notes`, `widgets`, `files`, `reminder_deliveries`, `notifications`; RLS; triggers
- Auth: email/password + Google OAuth (NextAuth)
- TipTap v3 editor; autosave: every keystroke → `localStorage`, debounced 1.2 s → Supabase
- Spaces (max depth 3), My Storeroom (null `space_id`), Tags, Home, My Room, Calendar, Search
- Widget system foundation: Reminder, File, Link — attached below note body, two-step creation
- App shell: desktop (top navbar + resizable sidebar 176–420 px) + mobile (bottom tab bar + left drawer + FAB)
- PWA manifest + icons; `.env.example`

### v1.1 — Personalization & Phase 2 *(Aug 7, 2026)*

- **Schema:** `supabase_schema_phase2.sql` — `notes.is_locked`, `note_versions` table + RLS
- Note locking (lock/unlock toolbar button)
- Version history panel (last 20, revertible)
- Export: Markdown + plain text via `lib/export.ts`
- Reminder email via Resend (`lib/resend.ts`); manual trigger `POST /api/reminders/send`
- Appearance settings: accent color (6 presets), typography, theme (light/dark opt-in), density, landing page
- Logo redesign: Y-mark + wordmark PNGs (ink + reversed), organized in `public/logo/`
- Hardened RLS; fixed Google OAuth duplicate insert bug

### v1.2 — UI Polish & Calendar *(Aug 7–8, 2026)*

- Delete notes/spaces; pin spaces to sidebar; space note counts
- Calendar multi-view (month/week); loading skeletons; file audit
- Fixed duplicate notes, date formatting, favicon, Google auth detection
- Full logo lockup in navbar; logo PNG files under `public/logo/`
- Fixed widget duplication; calendar redesigned with unscheduled tray
- **React Strict Mode fix:** all note/widget creation in click handlers (`FAB.tsx`), never `useEffect`
- Editor toolbar overhaul; dedicated space pages; note drag-to-space (`lib/dnd.ts`)
- Autosave hardening: retry loop, `flushNote()` on `beforeunload` + `visibilitychange`
- PWA/mobile fixes: tab bar safe-area, calendar layout, editor toolbar; half-dark theme fix

### v1.3 — Widget System, Theming & Dark Mode *(Aug 10–11, 2026)*

- **Schema:** `supabase_schema_phase3.sql` — `users.app_background_preference`, `users.background_tint_preference`; `supabase_schema_phase4.sql` — RLS hardened on all 8 tables, `anon`/`authenticated` access to `public` schema revoked
- Full widget system: `WidgetPicker` (2-step), `ReminderForm`/`FileForm`/`LinkForm`, display components; "Add" button in toolbar
- Sidebar inline note lists (`SpaceNoteList`)
- Per-space color theming (`lib/spaceColor.ts`); app background graphics (Plain/Dots/Grid/Diagonal/Rings/Glow); page tint
- `lib/theme.ts` as single source of truth — `resolveTheme()` used on server + client identically; two caches: `ruang_theme_cache` (blocking pre-paint) + `ruang_prefs` (React)
- Complete dark mode — opt-in only; `Logo.tsx` renders both cuts, CSS hides one via `data-theme`; no JS flash
- `SECURITY_REVIEW.md` created; cross-tenant writes fixed; SSRF redirect bypass fixed; security headers added; `lib/ownership.ts` + `lib/ratelimit.ts` introduced

### v1.4 — Mobile Hardening & Theme Persistence *(Aug 12–14, 2026)*

- **Schema:** `supabase_schema_phase5.sql` — drops and recreates appearance `CHECK` constraints unconditionally (fixes stale constraint names from earlier migrations)
- WhatsApp paste formatting fix
- Mobile toolbar docked above keyboard: `lib/keyboardInset.ts` publishes `--kb-inset` via Visual Viewport API; `ToolbarButton` calls `preventDefault()` on `mousedown`; `.docked-toolbar-gap` reserves space
- Theme persistence fix: `PreferencesProvider` no longer overwrites cached theme with defaults; rejected `PATCH /api/users` rolls back + surfaces `saveError`
- Email verification via Resend on signup; pre-confirmed fallback if Resend is unavailable
- Reversed logo in dark mode; `overscroll-behavior: none` on `html`/`body` + all inner scrollers

### v1.5 — Schema & Shell Hardening *(Aug 18, 2026)*

- **Schema:** `supabase_schema_phase6.sql` — pins `search_path` on all schema functions; revokes `EXECUTE` from `PUBLIC` (closes PostgREST RPC exposure for `SECURITY DEFINER` functions)
- Shell scroll bug fixed (app canvas no longer scrolls the document)
- "Add Widget" seated permanently in the formatting toolbar
- Remaining half-dark artifacts neutralized
- Appearance tab names the reason a save failed; drifted `CHECK` constraints rebuilt

### v1.6 / Phase 7 — First-class To-dos *(Aug 18–24, 2026)*

The largest single feature addition. A `todos` row, not a note.

- **Schema:** `supabase_schema_phase7.sql` — `todos`, `todo_attachments`, indexes, RLS, seven `users.todo_*` preference columns; `supabase_schema_phase8.sql` — performance indexes for to-do query shapes; `supabase_schema_phase9.sql` — `users.color_scheme` + CHECK; `supabase_schema_phase10.sql` — `files.widget_id` made nullable
- `/todo`: Today / Week / Month / All; list only (calendar stays at `/calendar`)
- Quick add with typed date/duration parsing ("fri 3pm", "~20m")
- **Drag and drop** — Pointer Events (works on touch); cross-date; keyboard (`Ctrl/Cmd + ↑/↓`); ghost card via `transform` on its own node, never React state
- **Two-context architecture** — `useTodoActions()` (stable) + `useTodos()` (state); `TodoRow` is `React.memo`'d; no background refetch after mutations
- Sub-tasks (one level; Independent/Dependent completion); recurrence (one row at a time); rollover (idempotent, defaults **off**)
- **PeriodView** — open-ended Week/Month with bidirectional IntersectionObserver scroll; instant scroll correction on prepend; `scroll-behavior: smooth` removed from `globals.css`; scroller is `data-app-scroll`, not `window`
- "Anytime" tray (undated work that is real but not owed to a day)
- Focus mode with 25-minute timer; progress bar + streak
- **Colour schemes** — 5 presets (Ruang Calm / Electric Indigo / Citrus / Emerald / Neon Dusk); stored in `users.color_scheme`; selecting a scheme also nulls `accent_color`
- Sticky frosted-glass headers with scrollspy period title
- `OverdueGroup` — carried-over items pinned above all groups in amber, never red ("carried over", not "overdue error")
- Checklist-note migration: `POST /api/todos/migrate`; note preserved; `source_note_id` makes it re-runnable
- One calendar at `/calendar`; `/todo` Calendar control is a link, not a toggle; `CalendarScreen` wraps `TodoProvider` + `TodoDragProvider`
- Rollover defaulted to **off** (overdue items stay where they are)

### v1.7 — Bug Fix Patch *(Aug 26, 2026)*

Auth hardening, forgot-password flow, file upload fix, sub-task persistence fix, Settings About tab.

- **Auth:** email/password signup no longer returns "Registration failed" for duplicate `auth.users` entries — edge case handled silently
- **Google OAuth:** `signIn` callback now queries `auth.users` schema directly before `createUser`; partial-signup accounts (auth row present, `public.users` row missing) no longer show AccessDenied
- **Forgot password — full HMAC-OTP flow:**
  - `POST /api/auth/forgot-password` — rate-limited 3/15 min/IP; generates TOTP-style 6-char code via `lib/otp.ts`; sends via Resend; always returns `{ ok: true }` (anti-enumeration)
  - `POST /api/auth/verify-otp` — rate-limited 3 attempts/30 s per email+IP; accepts current + previous 10-min window (~20 min total validity); issues signed reset token on success
  - `POST /api/auth/reset-password` — verifies HMAC + 30-min expiry; updates password via `auth.admin.updateUserById`
  - Login page: 4-step UI (email → OTP input with 30 s cooldown → new password → done)
  - `lib/otp.ts` — OTP utilities extracted from route file (Next.js route export rule: only HTTP handlers may be exported)
- **Todo file attachment "Failed to fetch":** browser-side presigned PUT blocked by R2 CORS; replaced with server-side FormData proxy via `putToR2()` in `lib/r2.ts`; `AttachPopover.tsx` now POSTs `multipart/form-data` directly; `api/todos/[id]/upload/route.ts` handles both multipart and legacy JSON paths
- **Sub-task disappearance:** completed parent rows now always render their sub-task list; `SubtaskRow` shows its own due date when different from the parent's; overdue open sub-tasks display a red "Overdue" notice
- **Settings → About tab:** version badge, version history table, stack credits

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR, API routes, TypeScript |
| Auth | NextAuth.js + Google OAuth | Email/password + Google OAuth |
| Database | Supabase (PostgreSQL) | DB and auth ONLY -- never file storage |
| File storage | Cloudflare R2 | All file bytes. S3-compatible, presigned URLs |
| RTE | TipTap v3 | Block-based editor; extensions listed below |
| Email | Resend | Reminder delivery (built, env var: RESEND_API_KEY) |
| Deployment | Vercel | Zero-config |
| UI | Tailwind CSS | shadcn/ui was scaffolded and never adopted -- the twelve unused components, `cn()`, every `@radix-ui/*` package, `clsx`, `tailwind-merge` and `class-variance-authority` were removed. Do not reintroduce them; see rule 9 |
| PWA | Native manifest | manifest.json + icons in /public/logo/; next-pwa NOT used |

**Repo:** `github.com/Bogi674/ruang-project-management`, branch `main`
**Deployment:** `ruang-project-management.vercel.app`
**Supabase project ref:** `dbzkxfqrtonzwefdizof` (configured in `.mcp.json` for MCP access)

---

## Design Philosophy

1. **Speed before structure.** Capture takes zero decisions. Organization is always optional and always post-capture.
2. **The desk metaphor.** Your Ruang is your desk. It reflects how you work.
3. **Calm, not cluttered.** UI surfaces only what is needed at that moment.
4. **ADHD-friendly without being patronizing.** No popups. No mandatory fields. No "are you sure?" dialogs. Always autosaving.
5. **Expression is a feature.** Deep personalization without it feeling like a settings page.

**Aesthetic:** Clean, editorial, calm. Generous whitespace. Closer to a well-designed notebook than a SaaS dashboard.

---

## Data Model

```sql
users
  id, email, name, avatar_url,
  accent_color, typography_preference, surface_preference,
  density_preference, landing_page_preference, theme_preference,
  app_background_preference, background_tint_preference,   -- added in supabase_schema_phase3.sql
  created_at

spaces
  id, name, color, icon (emoji), owner_id,
  parent_id (nullable -- null = top-level space),
  path (materialized text, e.g. "work/design/ui-research"),
  depth (0-2, max 3 levels enforced by DB CHECK and UI),
  is_shared, created_at

notes
  id, user_id,
  type (note | checklist),
  title (auto-derived from first line of content -- set via textarea, synced to DB),
  content (TipTap JSON),
  space_id (nullable -- null = lives in My Storeroom),
  tags (jsonb array),
  pinned_date (date, nullable),
  pinned_date_end (date, nullable),
  is_pinned_to_home (bool),
  is_locked (bool) -- added in supabase_schema_phase2.sql
  is_public (bool, Phase 3 only),
  published_at (nullable, Phase 3 only),
  created_at, updated_at

todos  -- added in supabase_schema_phase7.sql
  id, user_id,
  parent_id (nullable -- non-null = sub-task, exactly one level deep),
  space_id (nullable), title, description,
  due_date (date, nullable), due_time (time, nullable),   -- set independently
  estimate_minutes, position (double precision -- fractional ordering),
  is_completed, completed_at,
  subtask_mode (independent | dependent),
  recurrence (jsonb), recurrence_parent_id,
  reminder (jsonb), source_note_id (set by the checklist migration),
  created_at, updated_at

todo_attachments  -- added in supabase_schema_phase7.sql
  id, todo_id, user_id, kind (file | note), file_id, note_id, created_at
  (CHECK enforces exactly one target, matching `kind`)

note_versions  -- added in supabase_schema_phase2.sql
  id, note_id, user_id, content (jsonb), title, created_at
  (max 20 per note; ordered by created_at desc; revertible)

widgets
  id, user_id,
  note_id (nullable -- null = standalone widget),
  type (reminder | file | link),
  content (jsonb -- shape varies by widget type),
  created_at

files
  id, widget_id, uploaded_by, filename,
  r2_object_key, r2_bucket, mime_type, size_bytes, created_at

reminder_deliveries
  id, widget_id, recipient_id, channel, status,
  scheduled_at, sent_at, error_message

notifications
  id, recipient_id, actor_id, type, message, is_read, created_at
```

### Widget content shapes (jsonb)

**Reminder:**
```json
{
  "title": "",
  "description": "",
  "date": null,
  "time": null,
  "recurrence": "once",
  "type_label": "Deadline | Follow-up | Meeting | Review",
  "recipients": [],
  "send_times": 1,
  "send_early": "1h"
}
```
`send_early` values: `"15m" | "30m" | "1h" | "3h" | "1d" | "3d" | "1w"`

**File:**
```json
{ "display_name": "", "description": "" }
```
(Actual file stored in R2. Metadata in `files` table linked via `widget_id`. `display_name` falls back to uploaded filename if empty.)

**Link:**
```json
{
  "url": "",
  "og_title": "",
  "og_description": "",
  "og_image": null,
  "domain": "",
  "note": ""
}
```

### Schema files
- `supabase_schema.sql` -- core schema (users, spaces, notes, widgets, files, reminder_deliveries, notifications + RLS + triggers)
- `supabase_schema_phase2.sql` -- additive: `notes.is_locked`, `note_versions` table + RLS
- `supabase_schema_phase3.sql` -- additive: `users.app_background_preference`,
  `users.background_tint_preference` + CHECK constraints
- `supabase_schema_phase4.sql` -- hardening + backfill: re-asserts every appearance
  column (phase 2 and 3 in one place), enables RLS on all eight tables, and revokes
  `anon` / `authenticated` access to the whole `public` schema
- `supabase_schema_phase5.sql` -- **rebuilds the appearance CHECK constraints
  unconditionally** from the value lists in `lib/theme.ts`
- `supabase_schema_phase6.sql` -- clears the Supabase database linter: pins
  `search_path` on the schema's functions and revokes their EXECUTE grant **from
  `PUBLIC`**
- `supabase_schema_phase7.sql` -- additive: the `todos` and `todo_attachments`
  tables, their indexes and RLS, and seven `users.todo_*` preference columns.
  Deliberately does **not** grant the new tables to `authenticated`: phase 4
  took `usage on schema public` away from that role because every query goes
  through a Next.js route on the service role, and granting here would put the
  tables back on the Data API the moment schema usage were restored.

- `supabase_schema_phase9.sql` -- additive: `users.color_scheme` and its CHECK.
  **Adding a fifth scheme to `COLOR_SCHEMES` needs a new drop-and-recreate migration** --
  an `if not exists` guard on the constraint name would silently skip it (see phase 5).
- `supabase_schema_phase8.sql` -- additive: four indexes matching the query
  shapes the routes issue today (the undated branch of the filtered load, the
  single-statement count, completed parents, and the attachment embed). No data
  or privilege changes. Its header records what could **not** be verified: the
  live database is unreachable from the agent sandbox, so nothing in it was
  checked against a real `EXPLAIN`.

All nine files are idempotent (safe to re-run). **Phase 5 supersedes phases 3 and 4
for the appearance columns and their constraints** -- running it alone is enough to
bring an older database up to date. A missing preference column is not cosmetic:
PostgREST fails a `select` as a whole when one column in it is unknown, which made
the server read *no* preferences and dark mode revert to light on every load.

Phases 3 and 4 guard `add constraint` with
`if not exists (select 1 from pg_constraint where conname = ...)`. That keys on the
constraint **name**, not on what it says, so a database that received an earlier
draft keeps the older allowed-value list forever and every later run decides there
is nothing to do. Phase 5 drops and recreates instead (resetting out-of-list rows to
NULL first, since `add constraint` validates existing rows). **Any future change to
`APP_BACKGROUND_VALUES`, `BACKGROUND_TINT_VALUES` or `THEME_VALUES` needs a matching
drop-and-recreate migration -- an `if not exists` guard will silently skip it.**

Phase 6 covers a second trap in the same family. Postgres grants `EXECUTE` on every
new function to `PUBLIC`, and PostgREST publishes anything executable at
`/rest/v1/rpc/<name>` -- including `handle_new_user()`, which is `SECURITY DEFINER`.
Phase 4's `revoke all on all functions ... from anon, authenticated` does **not**
close that: revoking from a role leaves the privilege it inherits from `PUBLIC`
intact, so `PUBLIC` has to be named. Phase 6 also pins `search_path` on every
function this schema owns. It does *not* revoke across the whole schema:
`supabase_schema.sql` creates `uuid-ossp` with no target schema, so
`uuid_generate_v4()` can land in `public`, and `spaces.id` / `notes.id` default to
it -- a blanket revoke would break row creation. **A new function in `public` needs
its own `revoke execute ... from public` and a pinned `search_path`.**

---

## Critical Rules -- Read Before Writing Any Code

### 1. Supabase is DB and auth ONLY -- never file storage

All file bytes go to Cloudflare R2. Never call `supabase.storage`.

File upload pattern:
1. Client requests presigned PUT URL from `/api/files/upload-url`
2. Client uploads file directly to R2 (no bytes through Next.js server)
3. Client saves metadata to `files` table via POST `/api/files`

File read pattern:
1. Client calls `/api/files/[id]` GET
2. Route verifies ownership, generates presigned GET URL
3. Client uses URL for preview or download

R2 env vars:
```
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=
```

### 2. Note titles are never user-entered from scratch, but ARE editable

The `title` column is auto-populated via a `<textarea>` above the TipTap editor. It auto-resizes.
There is no separate "title field" the user consciously fills -- the first line of writing becomes the title.
The derived title is synced to the DB on every autosave, along with the TipTap content.

### 3. Spaces have a maximum depth of 3 levels (depth 0, 1, 2)

- `depth: 0` = top-level space (no parent)
- `depth: 1` = child of a top-level space
- `depth: 2` = grandchild (maximum allowed depth)

Enforce this in both DB constraint (`CHECK (depth between 0 and 2)`) and UI (hide "New sub-space" option at depth 2).
The `path` column is a materialized text path, e.g. `"work/design/ui-research"`.

### 4. A note with no space_id lives in My Storeroom

Never auto-assign a space. `space_id = null` is valid and expected for most new notes.
My Storeroom is not a real space in the DB -- it's a UI filter for `notes WHERE space_id IS NULL`.

### 5. Widgets live below the note body -- never inline in prose

Widgets (Reminder, File, Link) always render in an "Attached Widgets" section below the TipTap editor.
They are not block types inside TipTap. Checklists ARE a TipTap block type (not a widget).

### 6. Standalone widgets are valid

`widgets.note_id = null` means the widget exists independently (e.g. a reminder with no note).
Standalone widgets appear in Home > Upcoming and in My Storeroom.

### 7. Widget creation is two-step -- nothing written until form submit

The WidgetPicker opens a type-selector first, then a form. No widget row is written to the DB until
the user clicks "Add to Note". Cancelling the form leaves no empty row behind.

FAB widget deep-link: FAB creates the note first, then redirects to `/note/[id]?widget=[type]`.
NoteEditor reads `?widget` from the URL on mount, opens WidgetPicker with that type preset, then
strips the param from the URL so a refresh does not reopen it.

### 8. React Strict Mode + useEffect for creation = duplicate entries

Creation triggers must live in click handlers, never in useEffect. This pattern is established in
FAB.tsx and must be followed for all note/widget creation code.

### 9. Never write a literal colour in a component

Every colour comes from a CSS custom property declared in `globals.css`. `tailwind.config.ts`
maps the whole palette onto those properties, so `bg-bg-base`, `text-text-primary`,
`border-border-default` and the rest follow the theme automatically. A hard-coded hex,
`bg-white`, or `bg-black/30` re-creates the half-dark bug this replaced.

Two consequences to remember:
- Tailwind's `/opacity` modifier does **not** work on a `var()` colour. Use
  `--accent-wash-strong`, `--accent-wash-soft`, `--scrim`, `--scrim-strong`, or an explicit
  `color-mix()`.
- Text on a filled accent surface uses `text-accent-ink`, not `text-white` -- the accent can be
  Sand or Sage, which white does not read on.

Space colours are user data and are legitimately inline; that is the exception.

### 10. Service role bypasses RLS -- every query carries its own filter

`createServerClient()` caches its client at module scope. A fresh `createClient()`
per request threw away the keep-alive pool and paid a TLS handshake per query --
on a route running four statements that was most of its latency. Caching is safe
because the client holds no per-user state (`persistSession` is off); it is
**not** a licence to drop the `.eq('user_id', userId)`.

All server queries use the Supabase **service role** client, so the RLS policies in
`supabase_schema.sql` never execute. A missing `.eq('user_id', userId)` is a cross-tenant data
leak with nothing behind it.

A row-level filter is not enough when the request body also supplies a foreign key
(`note_id`, `space_id`, `widget_id`, `parent_id`, `r2_object_key`). Resolve those through
`lib/ownership.ts` (`ownsNote` / `ownsSpace` / `ownsWidget` / `isUuid`) and return 404 when the
reference is not the caller's. See `SECURITY_REVIEW.md` for the four routes where this was
missing and what it allowed.

---

## Autosave Architecture (Hybrid Sync)

This is a deliberate middle-path decision. Full offline-first (IndexedDB + service worker +
conflict resolution) was explicitly ruled out as too complex. The chosen approach:

**Every keystroke:** Write TipTap content + title to `localStorage`. Key: `ruang_draft_${noteId}`.
Draft shape: `{ content: TipTapJSON, title: string }`.
**1.2 seconds after last keystroke:** Debounced Supabase sync fires (PATCH `/api/notes/[id]`).
**On sync failure:** Retry silently up to 3 times with exponential backoff.
**On app open:** Load last `localStorage` state immediately while fresh DB data fetches behind it.
**PWA:** Installable via browser native manifest. Online required for sync. localStorage covers brief offline.

Autosave is in `lib/autosave.ts`. Key exports:
- `scheduleSync(noteId, content, setState, title?, delay?)` -- queue a debounced sync
- `flushNote(noteId)` -- force sync now (called on beforeunload and visibilitychange)
- `loadDraftFull(noteId)` -- returns `{ content, title } | null`
- `clearDraft(noteId)` -- called after successful Supabase sync
- `installFlushHooks()` -- sets up beforeunload + visibilitychange listeners

Sync indicator states (top navbar on desktop, below title on mobile):
- **Idle:** hidden
- **Syncing:** subtle spinner + "Saving..."
- **Synced:** "Saved" text, fades after 2 seconds
- **Error:** "Couldn't save -- check connection" (persistent, never auto-dismiss)

There is no save button anywhere in the app. Users can manually save a version checkpoint
from the note toolbar ("Save version") which calls POST `/api/notes/[id]/versions`.

---

## Design Tokens (Locked)

```css
/* Text */
--text-primary:      #2c3848;   /* headings, primary content */
--text-secondary:    #738290;   /* secondary labels, ghost buttons */
--text-muted:        #9aaab8;   /* tertiary text, placeholder hints */
--text-faint:        #b8c8d6;   /* timestamps, date labels */

/* Backgrounds */
--bg-base:           #ffffff;   /* main content areas */
--bg-subtle:         #f4f5f7;   /* sidebar background */
--bg-surface:        #f8fafc;   /* widget cards, calendar tray */
--bg-elevated:       #edf3fa;   /* icon wells */
--bg-page:           #f6f8fb;   /* login page */

/* Borders */
--border-default:    #e8ecf2;   /* card borders, dividers */
--border-light:      #f2f5f8;   /* list row dividers */
--border-medium:     #d8e0ea;   /* input borders, section separators */

/* Accent: Soft Blue (active states, FAB, today highlight, checked checkboxes) */
--accent-blue:       #A1B5D8;
--accent-blue-dark:  #4a6090;
--accent-blue-bg:    #dce8f6;

/* Accent: Sage Green (space chips, storeroom count) */
--accent-green:      #E4F0D0;
--accent-green-mid:  #C2D8B9;
--accent-green-dark: #4a6a40;

/* Accent: Slate (primary buttons, sidebar icons, toolbar) */
--accent-slate:      #738290;
--accent-slate-dark: #4a5a68;

/* Accent: Amber (pinned star icon in sidebar) */
--accent-amber:      #E8B23C;
--accent-amber-dark: #A9761A;
--accent-amber-bg:   #FDF3DC;

/* Danger: Orange (destructive actions only) */
--danger:            #F08050;
--danger-dark:       #E06830;
--danger-bg:         #fff4ee;
--danger-border:     #f8c8a8;
```

All six accent presets available in Appearance settings (user-selectable):
`#A1B5D8` Soft Blue / `#7eb87e` Sage / `#d4a574` Sand / `#d4879a` Rose / `#9b7ec8` Plum / `#738290` Slate

Selecting an accent updates `--accent-blue`, `--accent-blue-dark`, `--accent-blue-bg` in real-time
via `applyPreferences()` in `lib/preferences.ts`. Stored in `users.accent_color`.

### Typography

```
Display / Headings: 'Newsreader', Georgia, serif
  Load: https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,300;0,400;0,500;1,400&display=swap
  Page titles:          26-34px, weight 400, letter-spacing -0.02 to -0.025em, color #2c3848
  Section heads:        18-22px, weight 400, letter-spacing -0.02em
  Card titles:          14.5-15px, weight 400
  Note title (editor):  26-34px, letter-spacing -0.025em, line-height 1.2

Body / UI: system-ui, -apple-system, 'Segoe UI', sans-serif
  Body text:            14-14.5px, line-height 1.78, color #3a4a5c
  UI labels:            12-13.5px, color #2c3848
  Secondary:            11.5-12.5px, color #9aaab8
  Timestamps:           10.5-11.5px, color #b8c8d6
  Input text:           13.5-15px, color #2c3848

Section labels: ui-monospace, monospace
  9.5px, letter-spacing 0.1em, UPPERCASE, weight 500, color #b0bcc8
```

### Spacing

```
Desktop content padding:    36px 44px
Note editor padding:        44px 80px (max-width 820px, centered)
Sidebar default width:      280px (resizable, range 176-420px, persists to localStorage: ruang_sidebar_width)
Top navbar height:          52px (desktop), 56px (mobile)
Bottom tab bar height:      49px (mobile) + safe-area-inset-bottom
Formatting toolbar height:  46px (desktop), 44px (mobile)
Card border-radius:         11-12px
Input border-radius:        8-10px
Button border-radius:       7-10px
Widget card radius:         10px
Row item min-height:        52px (mobile), 44px (desktop)
Icon well size:             28-44px square, radius 6-10px
```

### Shadows

```
Note card (rest):   0 1px 4px rgba(44,56,72,.04)
Note card (hover):  0 6px 20px rgba(44,56,72,.09)
Modal / overlay:    0 16px 56px rgba(44,56,72,.14), 0 2px 8px rgba(44,56,72,.06)
FAB (rest):         0 4px 16px rgba(161,181,216,.4)
FAB (hover):        0 8px 28px rgba(161,181,216,.5)
FAB menu popup:     0 8px 32px rgba(44,56,72,.13), 0 2px 6px rgba(44,56,72,.06)
```

### Motion

```
Screen entry:    fadeUp -- opacity 0 to 1, translateY 8px to 0, 0.2s ease
Drawer:          slideLeft -- translateX(-100%) to 0, 0.22s ease
Hover:           0.1-0.15s on background, shadow, transform
Note card hover: translateY(-2px) + enhanced shadow
FAB open:        rotate(45deg) + background #738290, 0.15s
Cursor blink:    pulse -- opacity 1 to 0.4 to 1, 1.1s ease infinite
```

---

## Theming Architecture

`lib/theme.ts` is the single source of truth. It is pure and framework-free, and both sides use
the same output:

- **Server:** `src/app/layout.tsx` loads the signed-in user's preference columns, calls
  `resolveTheme()`, and renders the resulting `data-*` attributes and CSS custom properties
  directly onto `<html>`. This is why the theme survives a reload with no flash, and why
  `/login` and `/signup` are themed too.
- **Client:** `applyPreferences()` in `lib/preferences.ts` writes the identical output to
  `document.documentElement` when a setting changes, and mirrors it into `localStorage`. A tiny
  blocking script in `<head>` replays that cache when the server had no session to read.

`resolveTheme()` derives the accent chip fill (`--accent-blue-bg`) and its ink
(`--accent-blue-dark`) **per theme** -- a wash toward white in light mode, toward the dark base
in dark mode. The locked Soft Blue pair (`#dce8f6` / `#4a6090`) is used verbatim rather than
derived, so the default look is unchanged.

`PreferencesProvider` lives in `app/providers.tsx` at the root, not in the app shell.

### Why the theme sticks (three rules that must hold together)

1. **The root layout's `select` is tiered.** It asks for the full column list, and on
   error falls back to the columns that have shipped since the first schema file.
   PostgREST fails a `select` as a whole when one column is unknown, so a database
   missing the phase-3 columns otherwise returns *nothing* -- including
   `theme_preference` -- and the server renders the light default.
2. **The client never repaints defaults over a cached theme.** When the server sends
   no preferences (login page, PWA cold start, unreadable session) the pre-paint
   script has already restored the cached palette. `PreferencesProvider` adopts the
   cached *values* and reconciles from `/api/users`; calling
   `applyPreferences(defaultPreferences)` there paints light over dark **and**
   overwrites the cache with it. That loop was the "dark mode resets on every
   launch" bug.
3. **There are two caches and they are not interchangeable.** `ruang_theme_cache`
   holds resolved attributes and custom properties for the blocking pre-paint script
   (which cannot import `theme.ts`). `ruang_prefs` holds the raw values React needs.
   `applyPreferences()` writes both.

A rejected `PATCH /api/users` now rolls the change back and surfaces `saveError` on
the Appearance tab, rather than showing a setting that silently was never stored.

Attributes on `<html>`: `data-theme`, `data-density`, `data-surface` (omitted when "clean"),
`data-app-bg`, `data-tint`.

The app canvas is `.app-canvas` on the shell root. Its `::before` carries the background graphic
at `z-index: -1` inside a stacking context, so no child needs a z-index and the fixed navbar, tab
bar and FAB are untouched. `.note-paper` always paints `--bg-base`: the background customisation
is for dashboards, never for the surface you write on.

`Logo.tsx` renders **both** logo PNGs -- the dark-ink cut and the `_reversed` (white) cut -- and
`globals.css` hides one with `:root[data-theme="dark"]`. Do not pick the `src` in React: the theme
attribute is on `<html>` before React runs, so a JS choice flashes the ink logo on every dark load
and cannot match on the server.

### Overscroll

`html`/`body` set `overscroll-behavior: none`, and every long-lived inner scroller (the TipTap
body, sidebar, mobile drawer, calendar grid) carries `overscroll-none`. The elastic bounce drags
scrolled content away from the viewport edge while the fixed navbar, tab bar and FAB stay put, so
past the end of a note it read as a strip of bare canvas torn open at the bottom of the UI (and
the mirror of it at the top). `none` rather than `contain` -- `contain` only stops chaining and
leaves the bounce. It also removes pull-to-refresh, which an installed PWA should not have.

---

## Screen Inventory and Routes

| Screen | Route | Notes |
|---|---|---|
| Login | `/login` | Full-screen, no shell |
| Home | `/home` | Default landing. Pinned + Recent + Upcoming |
| Note Editor | `/note/[id]`, `/note/new` | Full content area |
| Note Editor (checklist) | `/note/new?type=checklist` | Pre-loads checklist block |
| My Storeroom | `/storeroom` | All unassigned notes |
| My Room | `/room` | Today focus + pinned + quick links + coming up |
| Search | `/search` | Full-text search |
| Calendar | `/calendar` | **The** calendar. Month/week/work-week/day, notes + widgets + to-dos, drag to assign date, unscheduled tray |
| To-do | `/todo` | Today / Week / Month / All. List only -- the calendar switch links to `/calendar`. Week and Month are open-ended: scrolling past either end reaches the neighbouring period |
| Account Settings | `/settings` | Profile tab + Appearance tab + Danger zone |

All authenticated routes live inside an App Shell with top navbar + sidebar (desktop)
or top header + bottom tab bar (mobile). Shell is in `src/app/(app)/layout.tsx`.

---

## App Shell Components

### Desktop

**Top Navbar** (52px, white, border-bottom 1px #e8ecf2)
- Left: Logo component (Y-mark + "ruang" wordmark, Newsreader 17px), navigates to /home
- Center-left: 5 nav tabs -- Home / To-do / Calendar / My Room / Search
  (To-do sits second: it is the screen the app is opened for daily)
  - Active tab: color #2c3848, font-weight 580, border-bottom 2.5px solid #A1B5D8
  - Inactive: color #9aaab8
- Right: keyboard shortcut button (?) + focus mode toggle (F) + autosave indicator (note only) + notification bell + avatar (32px, navigates to /settings)

**Left Sidebar** (default 280px, bg #f4f5f7, border-right 1px #e8ecf2, always visible unless focus mode)
- Resizable: drag handle on right edge. Range: 176-420px. Persists to `localStorage` key `ruang_sidebar_width`.
- Sections: PINNED (My Storeroom with green count badge, then My To-do with its
  open count) / SPACES (tree with + button) / Settings gear
- Space tree items: color dot (7/6/5px by depth level) + name + emoji icon + note count
- Pinned spaces: star icon in amber, managed via localStorage `ruang_pinned_spaces`
- Expandable spaces: chevron shows sub-spaces AND inline note list (SpaceNoteList component)
- Note drag-to-space: drag a note card over a sidebar space to move it (custom MIME type: `application/x-ruang-note`)
- Active item: bg #dce8f6, color #4a6090, font-weight 580
- Focus mode (`F` key or navbar toggle): sidebar hidden, nav hidden, editor full-width

### Mobile

**Top Header** (56px, white, border-bottom 1px #e8ecf2)
- Default: hamburger left, logo center, bell + avatar right
- Inside note editor: back chevron left, note title center, overflow menu right

**Bottom Tab Bar** (49px, white, border-top 1px #e8ecf2, safe-area bottom)
- 5 tabs: Home / To-do / Calendar / My Room / Search
- Each: icon (SVG 20px) + label (10px), inactive #9aaab8, active #4a6090
- Hidden when note editor is open (editor is full-screen)

**Left Drawer** (280px, slides from left, slideLeft 0.22s, backdrop closes on tap)
- Contents: My Storeroom / Spaces tree / Settings / Profile footer

---

## FAB (Floating Action Button)

- Circle, 52px, bg #A1B5D8, white + icon
- Desktop: fixed bottom 28px, right 28px, z-index 50
- Mobile: fixed bottom = tabbar-total + 16px, right 20px, z-index 50
- Open state: rotate 45deg, bg #738290
- Loading state: spinner animation, bg #738290
- Popup: fixed card above FAB (bottom 68px from button, right-aligned)
- Outside click closes popup

**5 items in create menu:**
| Label | Action |
|---|---|
| Note | POST /api/notes, navigate to /note/[id] |
| To-do | Navigate to /todo?compose=1 -- writes nothing until the title is typed |
| Reminder | POST /api/notes, navigate to /note/[id]?widget=reminder |
| File Upload | POST /api/notes, navigate to /note/[id]?widget=file |
| Link / Bookmark | POST /api/notes, navigate to /note/[id]?widget=link |

Creation happens in the click handler inside FAB.tsx (not in useEffect). `setCreating(true)` locks
the button to prevent double-tap. Widget type is passed as a URL param, not pre-created.

---

## Widget System

Widgets live in an "Attached Widgets" zone BELOW the TipTap note body. Never inline in prose.
A widget with `note_id = null` is standalone (appears in Home > Upcoming, My Storeroom).

Entry points to add a widget:
1. "Add" button in the formatting toolbar inside the note editor
2. FAB create menu (Reminder, File Upload, Link/Bookmark) -- deep-links via `?widget=` param

**WidgetPicker flow (two steps):**
1. Type list: 3 option cards -- Reminder / File Attachment / Link/Bookmark
2. Form for chosen type -- filled by user
3. "Add to Note" submits: creates widget row + (for file) creates file row in one atomic sequence
4. Cancelling either step leaves no rows written

Widget Picker component: `src/components/widgets/WidgetPicker.tsx`
Form components: `src/components/widgets/forms/ReminderForm.tsx`, `FileForm.tsx`, `LinkForm.tsx`
Display components: `src/components/widgets/ReminderWidget.tsx`, `FileWidget.tsx`, `LinkWidget.tsx`
List row: `src/components/widgets/WidgetRow.tsx`

---

## TipTap Editor

Editor component: `src/components/editor/TipTapEditor.tsx`
Toolbar: `src/components/editor/FormattingToolbar.tsx`
Custom extension: `src/components/editor/IndentExtension.ts`
Version panel: `src/components/editor/VersionHistory.tsx`

**Installed extensions (TipTap v3):**
- StarterKit (includes paragraph, heading, bold, italic, strike, code, blockquote, horizontalRule, bulletList, orderedList, hardBreak, history)
  - `link.openOnClick: false` (links don't navigate on click in editor)
- Placeholder
- TaskList + TaskItem (nested: true) -- checklist
- Subscript, Superscript
- TextStyle, FontSize
- IndentExtension (custom -- Tab/Shift+Tab indent for lists)
- Table, TableRow, TableHeader, TableCell (resizable: true)

**Supported block types:** paragraph, H1/H2/H3, bullet list, ordered list, checklist (taskList), code block, blockquote, horizontal rule, table

**NOT yet implemented:** slash command picker (no SlashCommands.tsx), callout block

**Checklist pre-load:** When `isChecklist=true`, editor opens with a pre-populated taskItem block.

**Checked item style:** bg #A1B5D8, white tick, text line-through + color #b8c8d6.

---

## Note Editor (NoteEditor.tsx)

Located: `src/app/(app)/note/NoteEditor.tsx`

Key behaviors:
- Title `<textarea>` above TipTap editor: auto-sizing, synced to autosave
- Default title when blank: `"Untitled [Day], [DD] [Mon], [YYYY]"` (derived from note creation date)
- Locked notes: TipTap `editable=false`, title textarea disabled, all actions hidden except unlock
- Version checkpoint: "Save version" button in toolbar calls POST `/api/notes/[id]/versions`
- Version history panel: right-side panel (VersionHistory component), lists last 20, allows restore
- Space assignment: chip in toolbar opens SpaceAssignMenu popover
- Date assignment: chip in toolbar opens DatePickerPopover popover
- Export: "Export" button (desktop in toolbar, mobile in overflow menu) -- Markdown or plain text download
- Delete: confirm inline (no modal), then DELETE `/api/notes/[id]`, redirect to /home

---

## Content Types

### Note
- Opens with blinking cursor (#A1B5D8 animated bar). No fields required.
- First line = title (editable in textarea above editor).
- TipTap RTE with FormattingToolbar.

### Checklist note (legacy)
- Identical to Note but opens with a checklist (taskList) block pre-populated.
- Checklist item checked state: bg #A1B5D8, white tick, text line-through, color #b8c8d6.
- **No longer how a to-do is created.** The FAB's To-do entry routes to
  `/todo?compose=1` and `notes.type = 'checklist'` is kept only so existing
  notes still open and can be converted -- see the To-do System below.

---

## To-do System (phase 7)

A to-do is a `todos` row, not a note. Everything below lives under
`src/components/todos/` unless stated.

**State.** `TodoProvider` mirrors `PreferencesProvider`: one flat `Todo[]`
(parents *and* sub-tasks) with the grouped view derived in a `useMemo`. Flat is
the point -- a completion or a rename is a `map`, where a grouped structure
would need the row found and rebuilt inside whichever bucket it sits in. Every
mutation is optimistic and rolls the single row back on failure.

**It is two contexts, not one, and that is load-bearing.** `useTodoActions()`
returns the identity-stable half (every callback plus `prefs`); `useTodos()`
merges it with the state half. A component that renders *one* to-do must use
`useTodoActions()` and be `React.memo`'d -- `TodoRow` is. With a single context
the actions object was rebuilt on every render, so ticking one checkbox
re-rendered all forty rows. The grouping `useMemo` also caches its parent
objects: nesting sub-tasks produces `{...t, subtasks}`, and a fresh object
there defeats every memo downstream, so the previous object is reused whenever
the parent row and its children are the same references.

**Never refetch the window after a mutation.** There used to be a debounced
`GET /api/todos` 1.5s after every change; a second change landing inside that
window was overwritten by the in-flight reload, which is what made ticks and
drags visibly undo themselves. Only the headline counts come from outside the
current window, so only the counts are refetched (`GET /api/todos?count=true`,
one cheap statement). The rows on screen are never replaced by a background
request.

**Grouping** is in `lib/todoQuery.ts` and is shared by `GET /api/todos` and the
`/todo` server component, so the first paint and every later refetch agree.
The window is *not* a plain BETWEEN: it is "inside the range, OR undated, OR
open and already past", because overdue is pinned above the groups under every
filter. Drop the last clause and Monday morning hides the weekend's slippage.

**Dates.** `due_date` and `due_time` are two nullable columns, set
independently. Everything converting between them and `Date` goes through
`lib/todos.ts` -- `new Date('2026-08-18')` parses as *UTC* midnight and lands on
the 17th anywhere west of Greenwich, which would make "Today" wrong for half
the day.

**Ordering** is a fractional `position` scoped to `(user_id, due_date)`. A drop
writes the midpoint of its new neighbours, so a reorder -- including a
cross-date one, which carries the new `due_date` in the same PATCH -- is one
UPDATE. Midpoints run out of float precision eventually; `needsRebalance()`
detects that and the group is renumbered onto clean multiples in the same
request.

`reorder()` applies the move to local state **before** it sends anything. It
did not, and the comment claiming the caller had already done so was wrong --
so a drop across dates left the row where it started until something unrelated
reloaded the page, which read as "dragging does not work".

**Drag and drop** is `TodoDragContext`, built on **Pointer Events**, not the
HTML5 DnD that `lib/dnd.ts` uses for notes. HTML5 DnD does not fire on touch at
all, and cross-date reordering was asked for on a phone as much as a desktop.
Drop targets are found by hit-testing `data-drop-group` / `data-drop-index` in
the DOM, which is why calendar cells and the Unassigned tray are drop targets
with no wiring of their own. Touch lifts on a 350ms long press; a mouse lifts
after 4px of movement. `Ctrl/Cmd + ↑/↓` does the same thing from the keyboard.

**Nothing that changes at pointer speed goes through React.** The ghost card is
positioned by writing `transform` on its own node; the hit test runs once per
animation frame, not once per `pointermove`; and state is set only when the
*drop target* changes. It is also split the same way the to-do context is:
`useTodoDragActions()` is stable, so a row that only needs to start a drag is
not re-rendered by anybody else's. Putting `x`/`y` in React state -- which it
used to -- re-rendered every row on the page sixty times a second.

**Sub-tasks** are `todos` rows with `parent_id` set, **one level only**. The
database cannot express that (it needs a second row), so `POST /api/todos`
rejects a `parent_id` that itself has a parent. `subtask_mode = 'dependent'`
locks the parent's checkbox until its last sub-task closes, and the API
enforces it as well as the UI.

**Recurrence** generates one real row at a time: completing an instance creates
the next and points it at the rule's owner via `recurrence_parent_id`. Done on
completion rather than by a cron because there is no cron in this app yet.
`on_missed` defaults to `skip` -- rolling every missed occurrence forward turns
one abandoned daily habit into a wall of overdue.

**Rollover** is `POST /api/todos/rollover`, called once a day by the To-do page
(the same "no cron yet" constraint). Idempotent: the second call the same day
matches no past-dated rows. The server re-checks the setting -- the client
asking does not make it the user's choice.

**Carried over, not overdue.** Slipped to-dos render as their own amber panel
(`OverdueGroup`) pinned above every group under every filter, with the age of
each one in a gutter, the date of the oldest in the header, and one button that
brings the whole backlog to today. `--danger` is for destructive actions and
this is not one: being late is a state of affairs, not an error, and painting
it red makes a list of slipped work read as a telling-off. The wording follows
from the same thing -- "carried over", "waiting since Friday", "pull one
forward, push it out, or let it go".

**There is no default due *time*, and that was a decision made twice.** An
end-of-day 17:00 default was built and then rolled back: a time is a
commitment, and inventing one for every dated to-do filled the list with 17:00
rows nobody asked for, which then sort and remind as if a particular hour
mattered. A to-do carries a time only when one is typed (`fri 3pm`,
`tonight`). Do not reintroduce it.

**Week and Month are `PeriodView`, and every day is rendered.** A period is
addressed by an integer offset from the current one (`weekPeriod(-2)`), so the
list reaches backwards and forwards without passing dates around; scrolling
past either end appends the neighbouring period, and explicit "Earlier / Later"
buttons cover the case where a quiet week is too short to scroll at all. Empty
days are laid out too — a day you have not filled is still where Friday's work
goes, and in Month view it folds to a one-line `quiet` group that is still a
drop target with its own add button.

Four details are easy to break, and three of them shipped broken once:

- The backward sentinel takes **no** rootMargin and must be a real distance
  (`BACKWARD_TRIGGER_PX`) from the top edge, or it fires on mount and walks
  backwards on its own.
- Both observers must be rebuilt when the range changes, because an
  IntersectionObserver only reports threshold *crossings* and the sentinel does
  not move when a period is appended below it.
- **The scroll correction after a prepend must be instant, and only one prepend
  may be in flight.** Prepending shifts everything below the sentinel down by
  the height of the new period, and the offset is corrected by that much in a
  layout effect so nothing moves under the pointer. Animate that correction and
  it is not a correction: the offset stays wrong for the length of the
  animation, the sentinel is still on screen the whole time, and the list
  prepends again every frame — one flick of the wheel reached the MAX_REACH
  clamp six months out and kept going after the user let go. `scroll-behavior:
  smooth` on the document is what made it animate, which is why globals.css no
  longer sets it, and `settling` in PeriodView is what holds the second request
  until the first has landed.
- **The scroller is not the window.** `/todo` fills the content area and scrolls
  a region inside itself (`data-app-scroll`), so the range bar stays put and the
  page does not slide under the fixed navbar. Every measurement — the height to
  anchor against, the offset to test, the observer root, the drag auto-scroll —
  goes through `lib/scrollHost.ts`, which takes `null` to mean "the document" so
  the same code works on a screen that lets the document scroll.

**"Anytime", not "Unassigned".** Unassigned names a missing field; the list
actually holds work that is real and wanted but not owed to a particular day.
In the All view it is 40% of the page rather than a 300px rail -- All is the
one range where undated work is what you came to look at.

**Settings** are seven `users.todo_*` columns carried by `UserPreferences`
alongside the appearance ones -- same `/api/users` call, same `ruang_prefs`
cache, so the To-do page has them before first paint. They are *not* theme
values and `resolveTheme()` ignores them; `resolveTodoPreferences()` in
`lib/todos.ts` resolves the defaults, because null means "never chosen", not
"off".

**There is one calendar and it is `/calendar`.** `/todo` used to carry its own
month grid behind a List/Calendar switch: a second grid, a second set of drop
rules, a second answer to "what belongs on a day". The to-do layer moved into
`CalendarView` instead -- `CalendarScreen` wraps it in the same `TodoProvider`
and `TodoDragProvider` the list uses, so a to-do dropped on a day there runs
exactly the code a drop in a list runs. The filter bar's Calendar control is a
link, not a view toggle. Do not add a second calendar back.

**Migration.** `POST /api/todos/migrate` converts `type = 'checklist'` notes:
each TipTap `taskItem` becomes an unassigned to-do keeping its order, checked
state and the note's space. The note is never deleted, and each to-do links
back through `source_note_id` -- which is also what makes the card
re-runnable without duplicating anything.

---

## Organization System

### Spaces
- Optional. A note with no space is valid (lives in My Storeroom).
- Max depth: 3 levels (depth 0, 1, 2). Enforced in DB (`CHECK (depth between 0 and 2)`) and UI.
- Each space: name, color (hex), emoji icon.
- Moving a space re-nests all child spaces (update path for all descendants).
- Space chips: dynamic styling via `lib/spaceColor.ts` -- `spaceChipStyle(color)` returns `{ background, color, borderColor }` derived from the space color, WCAG-AA compliant.

### Tags
- Flat labels, JSONB array on `notes`.
- User-created, color-coded.
- Tag chip styles: green `.tag-chip` (#E4F0D0 bg, #4a6a40 text) or blue `.tag-chip-blue` (#dce8f6 bg, #4a6090 text).

### Dates
- Any note or widget can have a `pinned_date` and optional `pinned_date_end`.
- Date assigned = item appears on Calendar.
- No date = stays in My Storeroom / Recent only.

---

## Appearance Settings (Live)

Settings page (`/settings`) has three tabs: **Profile**, **Appearance** and **To-do**.

**Appearance tab options:**
- Colour scheme: Ruang Calm (default) / Electric Indigo / Citrus / Emerald / Neon Dusk.
  A scheme sets the accent **and** the three semantic colours -- done, carried over,
  destructive -- and deliberately stops there: page, surface, border and text colours are
  untouched, so every scheme still reads as the same sheet of paper. `calm` emits *no*
  custom properties at all, so the default palette is the globals.css values verbatim and
  cannot drift as the table is edited. Stored in `users.color_scheme`.
- Accent color: 6 presets (Soft Blue, Sage, Sand, Rose, Plum, Slate). An explicit
  `accent_color` wins over the scheme's own accent, which is why picking a scheme in
  Settings sends `accent_color: null` alongside it -- otherwise a scheme would change the
  signal colours and leave the buttons the old colour.
- Typography: Sans-serif / Serif (Newsreader).
- Theme: Light / Dark. **Dark is opt-in only -- never inherited from OS.** This is now a
  product choice, not a limitation: the dark palette is complete (see Theming below).
- Density: Compact / Comfortable / Spacious. All three set `font-size` explicitly, and
  comfortable is declared at 16px rather than left to inherit -- it used to inherit the
  16px browser default while spacious *set* 15.5px, so choosing spacious made every
  rem-based Tailwind padding 3% **smaller** while the px type stayed put. `--density` is
  the multiplier for the places written in px; `.density-stack` and `.density-row` in
  globals.css are what actually consume it.
- App background: Plain / Dots / Grid / Diagonal / Rings / Glow -- the graphic on the app canvas
  behind Home, Storeroom, My Room, Search, Calendar and Spaces. Never applies to the note editor.
- Page tint: Neutral / Warm / Cool / Mint / Blush / Accent -- the canvas colour behind cards.
- Landing page: Home / My Room / Storeroom.

Preferences are stored in `users` and validated server-side in `/api/users` against the enums
exported by `lib/theme.ts`.

---

## Email (Live)

Lib: `lib/resend.ts` exports `sendReminderEmail()` and `sendVerificationEmail()`
Env vars: `RESEND_API_KEY` (required), `EMAIL_FROM` (optional, defaults to
`Ruang <reminders@ruang.app>` -- must be a sender Resend has verified for your domain)

**Reminders:** `POST /api/reminders/send` (manual trigger -- not cron-based yet). The
ReminderForm collects email recipients and send-early lead time, stored in the widget
`content` jsonb. Automated cron delivery is Phase 2.

**Account verification:** `POST /api/auth/register` creates the auth user *unconfirmed*
via `auth.admin.generateLink({ type: 'signup' })` and mails the returned `action_link`
itself, so verification does not depend on the Supabase project's SMTP settings. If
`RESEND_API_KEY` is unset, or the send throws, the route falls back to creating a
pre-confirmed account and logs a warning -- a deployment that cannot mail anyone would
otherwise refuse every signup. See finding 6 in `SECURITY_REVIEW.md`.

---

## Note Features (Live)

| Feature | Status | Notes |
|---|---|---|
| Note locking | Live | `is_locked` col, lock/unlock button in toolbar |
| Version history | Live | VersionHistory panel, last 20, POST /api/notes/[id]/versions |
| Export | Live | Markdown + plain text download via lib/export.ts |
| Focus mode | Live | `F` key or navbar button, hides sidebar + nav |
| Keyboard shortcuts | Live | `?` key opens KeyboardShortcutsPanel |
| Note drag-to-space | Live | DnD in sidebar + NoteCard context menu |

`lib/export.ts` exports: `noteToMarkdown(note)`, `noteToPlainText(note)`, `exportFilename(note, ext)`, `downloadTextFile(content, filename)`. Walks the full TipTap JSON tree (handles nested list items, task lists, code blocks, tables, blockquotes).

---

## Drag and Drop (lib/dnd.ts)

Custom MIME type: `application/x-ruang-note`
Payload: `{ noteId: string, fromSpaceId: string | null }`

Exports:
- `setNoteDragData(e, payload)` -- called on NoteCard dragstart
- `isNoteDrag(e)` -- checks MIME type during dragover
- `getNoteDragData(e)` -- parses payload on drop
- `moveNoteToSpace(noteId, spaceId)` -- PATCH /api/notes/[id] with new space_id
- `emitNotesChanged()` / `NOTES_CHANGED_EVENT` -- custom DOM event to refresh note lists after a move

Drop targets: sidebar SpaceItem rows, CalendarView day cells.

---

## Empty States

| Screen | Message |
|---|---|
| Home -- Pinned | "Pin a note to keep it at the top." |
| Home -- Upcoming | Hidden entirely if empty |
| My Storeroom | "Nothing here. That's a good sign." |
| Space (empty) | "Nothing in this space yet." |
| Calendar day | `+` icon on hover only |
| Search (no results) | "Nothing found for '[query]'." |
| First-time / nothing | "Your Ruang is ready. Tap + to write something." |

---

## Key Interactions (Implement Carefully)

1. **FAB expand** -- rotate + color change + popup card above, smooth 0.15s
2. **Note card to full-screen** -- fadeUp animation (translateY 8px to 0), feels like card expanding
3. **Autosave indicator** -- "Saved" appears quietly and fades in 2s; never alarming
4. **Checking off checklist item** -- checkbox fills #A1B5D8, text strikes through (subtle transition)
5. **Drag note onto sidebar space** -- drop highlight ring on space row, auto-expand on hover
6. **Drag note onto calendar** -- visual drag from unscheduled tray, date cell highlights on hover
7. **Widget picker opening** -- backdrop blur + modal slides in (two-step: type list then form)
8. **Left drawer (mobile)** -- slideLeft 0.22s, backdrop tap closes
9. **Today cell (calendar)** -- #A1B5D8 circle date number, blue outline on cell
10. **Blinking cursor (empty note)** -- #A1B5D8 animated bar, welcoming not intimidating
11. **Focus mode** -- sidebar and nav fade out, editor widens, toggle with `F` key
12. **Version restore** -- right-side panel, click version then "Restore" replaces editor content

---

## File Structure (Actual)

```
src/
  app/
    (app)/
      layout.tsx               -- App Shell (navbar + sidebar + FAB + focus mode + keyboard shortcuts)
      home/page.tsx            -- /home (Pinned + Recent + Upcoming reminders)
      note/
        NoteEditor.tsx         -- note editor logic (used by both new and [id] pages)
        NoteEditorWrapper.tsx  -- loading wrapper around NoteEditor
        new/page.tsx           -- /note/new (blank note; ?type=checklist for to-do)
        [id]/page.tsx          -- /note/[id] (existing note)
      storeroom/page.tsx       -- /storeroom
      room/page.tsx            -- /room
      search/page.tsx          -- /search
      calendar/
        page.tsx               -- /calendar
        CalendarScreen.tsx     -- mounts TodoProvider + TodoDragProvider around the view
        CalendarView.tsx       -- the app's only calendar: month/week/work-week/day,
                                  notes + widgets + to-dos, one unscheduled tray
    api/
      auth/[...nextauth]/      -- NextAuth handler
      notes/
        route.ts               -- GET list, POST create
        [id]/route.ts          -- GET, PATCH (autosave + lock + space + pin + date), DELETE
        [id]/versions/route.ts -- GET list (last 20), POST save checkpoint
      spaces/
        route.ts               -- GET list (with note_count + nested children), POST create
        [id]/route.ts          -- GET, PATCH, DELETE
      widgets/
        route.ts               -- GET list, POST create
        [id]/route.ts          -- GET, PATCH, DELETE
      files/
        upload-url/route.ts    -- GET presigned PUT URL for R2
        route.ts               -- POST save metadata
        [id]/route.ts          -- GET presigned GET URL, DELETE
      links/preview/route.ts   -- POST fetch OG metadata for a URL
      notifications/route.ts  -- GET, PATCH (mark read)
      reminders/send/route.ts  -- POST send reminder email via Resend (manual trigger)
      users/route.ts           -- GET + PATCH current user
      auth/
        register/route.ts      -- POST email/password signup
        change-password/route.ts -- POST change password
    login/page.tsx
    signup/page.tsx
    layout.tsx
    page.tsx                   -- redirect to /home or /login
    providers.tsx
    globals.css
  components/
    editor/
      TipTapEditor.tsx         -- main RTE component
      FormattingToolbar.tsx    -- formatting toolbar (desktop bottom / mobile bottom)
      IndentExtension.ts       -- custom Tab/Shift+Tab indent extension
      VersionHistory.tsx       -- right-side version history panel
    notes/
      NoteCard.tsx             -- card for Home + Storeroom + Space pages (with DnD + pin + delete)
      NoteList.tsx             -- list view wrapper
      NoteRow.tsx              -- row item for list views
      TagChip.tsx              -- tag chip UI
    widgets/
      WidgetPicker.tsx         -- two-step picker: type list then form (modal desktop / bottom sheet mobile)
      ReminderWidget.tsx       -- reminder display card
      FileWidget.tsx           -- file attachment display card
      LinkWidget.tsx           -- link preview card
      WidgetRow.tsx            -- compact widget row for list views
      forms/
        ReminderForm.tsx       -- reminder creation/edit form
        FileForm.tsx           -- file upload form (react-dropzone)
        LinkForm.tsx           -- link/bookmark form (fetches OG preview)
        fields.tsx             -- shared form field components (TextField, TextAreaField, SelectField, etc.)
    spaces/
      SpaceModal.tsx           -- create/edit space modal
      SpaceAssignMenu.tsx      -- popover for assigning a note to a space
    layout/
      TopNavbar.tsx            -- desktop top nav
      Sidebar.tsx              -- desktop sidebar with resizable drag handle
      SpaceNoteList.tsx        -- inline note list inside expanded sidebar space row
      MobileHeader.tsx         -- mobile top header
      MobileTabBar.tsx         -- mobile bottom tab bar (49px + safe-area)
      MobileDrawer.tsx         -- mobile left drawer
      FAB.tsx                  -- floating action button (all platforms)
      AutosaveIndicator.tsx    -- autosave status display
      NotificationBell.tsx     -- notification bell with unread count badge
      UserAvatar.tsx           -- avatar with initials fallback
      Logo.tsx                 -- Y-mark + wordmark SVG component
      KeyboardShortcutsPanel.tsx -- keyboard shortcut reference overlay (? key)
    home/
      Greeting.tsx             -- time-aware greeting with client-side date correction
    ui/
      DatePickerPopover.tsx    -- custom date picker popover (the only file here)
  lib/
    supabase.ts                -- createServerClient + createBrowserClient (never use for file storage)
    r2.ts                      -- getR2PresignedPutUrl, getR2SignedUrl, deleteFromR2
    auth.ts                    -- NextAuth config (Google OAuth + email/password)
    autosave.ts                -- localStorage draft cache + debounced Supabase sync
    api-helpers.ts             -- requireAuth, apiError helpers
    dnd.ts                     -- drag-and-drop helpers (custom MIME type, move note)
    export.ts                  -- TipTap JSON to Markdown / plain text
    theme.ts                   -- pure theme resolver (server + client); preference enums
    preferences.ts             -- PreferencesProvider + usePreferences hook + applyPreferences()
    keyboardInset.ts           -- useKeyboardInset(): publishes --kb-inset for the docked toolbar
    ownership.ts               -- ownsNote / ownsSpace / ownsWidget / isUuid (see rule 10)
    ratelimit.ts               -- in-memory fixed-window limiter (per-instance; see SECURITY_REVIEW.md)
    scrollHost.ts              -- which box is scrolling (data-app-scroll) + instant, never-animated scrolls
    spaces.ts                  -- useSpaces hook (fetches + caches spaces tree)
    spaceColor.ts              -- spaceChipStyle() + spaceDotColor() dynamic color derivation
    resend.ts                  -- sendReminderEmail() + sendVerificationEmail() via Resend SDK
    utils.ts                   -- formatDate, formatRelativeTime, extractTitleFromTipTap, etc.
  types/index.ts               -- all TypeScript interfaces (see below)
public/
  manifest.json                -- PWA manifest (standalone display mode)
  logo/
    ruang-icon-32.png
    ruang-icon-192.png
    ruang-icon-512.png
    ruang_logo.png
    ruang_logo.png, ruang_logo_reversed.png
    ruang_logo_text.png, ruang_logo_text_reversed.png
```

---

## TypeScript Types (src/types/index.ts)

Key types (non-exhaustive):

```typescript
type NoteType = 'note' | 'checklist';
type WidgetType = 'reminder' | 'file' | 'link';
type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly';
type ReminderLabel = 'Deadline' | 'Follow-up' | 'Meeting' | 'Review';
type ReminderLead = '15m' | '30m' | '1h' | '3h' | '1d' | '3d' | '1w';

interface Note {
  id, user_id, type, title, content, space_id, tags,
  pinned_date, pinned_date_end, is_pinned_to_home,
  is_locked,   // added in phase 2 schema
  is_public, created_at, updated_at,
  space?: Space | null,
  widgets?: Widget[]
}

interface NoteVersion { id, note_id, user_id, content, title, created_at }

interface ReminderContent {
  title, description?, date, time, recurrence, type_label,
  recipients?, send_times?, send_early?   // email delivery fields
}

interface FileContent { display_name?, description }
interface LinkContent { url, og_title, og_description, og_image, domain?, note }

interface PendingFileUpload { filename, r2_object_key, mime_type, size_bytes }
interface LinkPreview { domain, og_title, og_description, og_image }

interface AutosaveState { status: 'idle' | 'saving' | 'saved' | 'error'; lastSaved: Date | null }
interface CreateNotePayload { type?, space_id?, initialWidgetType? }
```

---

## Cloudflare R2 Integration

```typescript
// lib/r2.ts
getR2PresignedPutUrl(key: string, contentType: string): Promise<string>
getR2SignedUrl(key: string): Promise<string>
deleteFromR2(key: string): Promise<void>

// SDK: @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner
// Endpoint: https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
// Never use supabase.storage anywhere
```

---

## Mobile-Specific Requirements

- PWA installable via native browser prompt (manifest.json present; next-pwa not used)
- All primary actions reachable without scrolling to top
- Note editor: full-screen overlay, keyboard-aware layout
- Formatting toolbar: 46px strip, overflow-x auto, no scrollbar, **docked above the keyboard**
- Widget picker: bottom sheet only (not center modal)
- No hover states; all interactions are tap or long-press
- Calendar: month grid only (no unscheduled tray; access via My Storeroom)
- Safe-area insets on bottom tab bar (iOS home indicator)
- Tab bar height: 49px + `env(safe-area-inset-bottom)` = `--tabbar-total`
- FAB bottom offset: `calc(var(--tabbar-total) + 16px)` = `--fab-bottom`

### Docked mobile formatting toolbar

On phones the toolbar is **not** in the flow at the top of the editor -- that strip
is `hidden md:block`. `TipTapEditor` portals a second copy to `document.body` with
class `.docked-toolbar`, fixed to the bottom of the viewport, so it stays reachable
from whatever paragraph is being edited rather than only from the top of the note.

`lib/keyboardInset.ts` publishes `--kb-inset` on `<html>` and toggles
`data-keyboard="open"`. This is required, not a nicety: opening the keyboard on iOS
(Safari and standalone PWA alike) does not change `window.innerHeight` and does not
resize the layout viewport -- it only shrinks the **visual** viewport, so a
`bottom: 0` bar sits underneath the keyboard where it cannot be tapped. The inset is
`documentElement.clientHeight - (visualViewport.height + visualViewport.offsetTop)`,
written straight to the DOM (never React state -- it fires every scroll frame).

Two supporting pieces, both easy to break:
- `ToolbarButton` calls `preventDefault()` on `mousedown`. Without it every tap
  blurs the editor, the keyboard closes, and the bar drops mid-edit.
- `.docked-toolbar-gap` on the NoteEditor root reserves `--docked-toolbar-h` plus the
  safe-area inset, so the last line of writing is not trapped under the bar.
  `z-40` keeps it above the note and below every modal (`z-50`).

---

## Phase Roadmap

### Phase 1 -- Core (built)

- Auth: email/password + Google OAuth
- Note + To-do (checklist) creation and editing
- Autosave: localStorage draft cache (1.2s debounce) + Supabase sync
- Widgets: Reminder, File Attachment, Link Preview (standalone + attached)
- Widget picker (two-step: type select + form)
- Spaces (nestable max 3 levels, drag-to-assign, space chip dynamic colors)
- Tags
- Home dashboard (Pinned + Recent + Upcoming)
- My Storeroom
- My Room (Today's Focus + Pinned Notes + Coming Up)
- Calendar (month + week, drag to assign date, unscheduled tray)
- Search (full-text)
- Account Settings: Profile tab + Appearance tab (accent, typography, theme, density, landing page) + Danger zone
- Notification bell (in-app, badge count)
- FAB create menu (5 items)
- Desktop nav: top navbar + resizable sidebar (280px default, 176-420px range)
- Mobile nav: bottom tab bar + left drawer + FAB
- Focus mode (F key): hides sidebar + nav, full-width editor
- Keyboard shortcuts panel (? key)
- Note locking (is_locked)
- Version history (last 20, revertible)
- Export: Markdown + plain text download
- Reminder email send (manual trigger via POST /api/reminders/send + Resend)
- PWA installable (manifest.json + icons)

### Phase 7 -- First-class To-dos (built)

- `todos` + `todo_attachments` tables, RLS, and seven `users.todo_*` preference columns
- `/todo` with Today / Week / Month / All (list only -- the calendar lives at `/calendar`)
- Quick add everywhere (sticky bar, per-group inline row, Unassigned column, mobile sheet, FAB)
  with typed date/duration parsing ("fri 3pm", "~20m") echoed as dismissible chips
- Pointer-Events drag and drop: within a group, across dates, onto any cell of any
  `/calendar` view (month, week, work week, day), onto the Unassigned tray to clear
  a date; `Ctrl/Cmd + ↑/↓` from the keyboard. On touch, the mobile tray's date
  picker does the same job, since a drag cannot reach a cell behind a sheet.
- Sub-tasks with Independent / Dependent completion
- Deadline, Reminder, Repeat and Attach popovers; 440px detail drawer
- Focus mode with a 25-minute timer; progress bar and streak
- Recurrence, rollover, and the one-time checklist-note migration
- FAB To-do entry re-pointed; Home today-strip; sidebar and tab-bar entries

### Phase 2 -- Polish and Power (not yet built)

- Automated reminder cron delivery (scheduled worker checks reminder_deliveries table).
  To-do reminders reuse the same `ReminderLead` vocabulary and are stored ready for it,
  but nothing delivers them yet -- and the same worker should take over the
  rollover and recurrence checks that `/todo` currently runs on first load.
- To-do file attachments: `todo_attachments.kind = 'file'` and its API route exist,
  but the only upload path in the UI is the note editor's, so the Attach popover
  offers notes only.
- Space sharing (invite by email, viewer/editor roles)
- Focus mode per-space (currently focus mode is global)
- Slash command picker inside TipTap (/ command menu)
- Callout block type
- Notification system expansion

### Phase 3 -- Public Layer (not yet built)

- Public Ruang page (`ruang.app/[username]`)
- Publish individual notes
- Threaded note replies
- Follow a user's Ruang page
- Custom domain for public page

---

## Session Notes for Claude Code

- `SECURITY_REVIEW.md` holds the current security posture and the outstanding items,
  in priority order. Read it before touching auth, the API routes, or file handling.
- For GitHub push: use Classic PAT with `repo` scope embedded in remote URL:
  `git remote set-url origin https://<PAT>@github.com/Bogi674/ruang-project-management.git`
- PAT: stored in your password manager (classic PAT, repo scope, valid November 2026)
- Shell paths with `(app)` directory require escaping: `src/app/\(app\)/...`
- Default model: `claude-sonnet-4-6`. Escalate to `claude-opus-4-8` for complex architecture decisions.
- Build warning suppression: set `NPM_FLAGS=--loglevel=error` in Vercel env vars (silences ESLint 8 deprecation)
- Design reference files in project root: `Ruang_Prototype_dc.html` (desktop), `Ruang_Mobile_dc.html` (mobile)
  -- open via local server with `support.js`. These are the source of truth for visual implementation.
- Supabase project ref: `dbzkxfqrtonzwefdizof` (in `.mcp.json`)
- When reading from the repo, verify the file exists before writing code that imports it.
- Never duplicate schema details from supabase_schema.sql in API route code -- read the schema first.

---

## Session Starter Prompt

Paste this at the top of each new Claude Code session:

```
Building Ruang v1.0 -- a note-first personal workspace. NOT the old PM tool.
Stack: Next.js 14 App Router + TypeScript + Supabase (DB + auth only, NEVER file storage)
+ Cloudflare R2 (all file bytes) + TipTap v3 RTE + NextAuth (Google OAuth) + Tailwind + shadcn/ui.
Deployed on Vercel.

Key architecture decisions (locked):
- No Projects concept. Organization via Spaces only (nestable, max 3 levels).
- Content types: Note, Checklist (same as Note with checklist block pre-loaded).
- Widgets (Reminder, File, Link) attach BELOW note body -- never inline in prose.
- Autosave: every keystroke to localStorage, debounced 1.2s to Supabase. No save button.
- Note title = auto-derived from first line; editable in a textarea above TipTap. No separate title field.
- note.space_id = null means the note lives in My Storeroom (not a real DB entity).
- All file bytes go to R2. Never supabase.storage. r2_object_key stored in files table.
- Widget creation is two-step (type picker then form). Nothing written until "Add to Note".
- FAB creates note first, then deep-links to /note/[id]?widget=[type] for widget setup.
- Sidebar is resizable (default 280px, range 176-420px), not collapsible.
- Phase 2 features already live: note locking, version history, export, focus mode, keyboard shortcuts, appearance settings, reminder email.

Refer to CLAUDE.md for full context, design tokens, data model, and critical rules.

Today's task: [specific feature to build]
```
