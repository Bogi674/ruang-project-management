# Ruang v1.0 — Claude Code Context File

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
| UI | Tailwind CSS + shadcn/ui | |
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

All four files are idempotent (safe to re-run). **Phase 4 supersedes phase 3 for
the column list** -- running it alone is enough to bring an older database up to
date. A missing preference column is not cosmetic: PostgREST fails a `select` as
a whole when one column in it is unknown, which made the server read *no*
preferences and dark mode revert to light on every load.

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
Top navbar height:          52px (desktop), 56px (mobile) -- + safe-area-inset-top
Bottom tab bar height:      49px (mobile) + safe-area-inset-bottom
Formatting toolbar height:  46px (desktop), 44px (mobile)
Card border-radius:         11-12px
Input border-radius:        8-10px
Button border-radius:       7-10px
Widget card radius:         10px
Row item min-height:        52px (mobile), 44px (desktop)
Icon well size:             28-44px square, radius 6-10px
```

### Chrome metrics and the viewport -- three rules that must hold

The root viewport is `viewport-fit=cover`, so the layout viewport runs edge to
edge, underneath the status bar and the home indicator. Every fixed bar and
every content offset therefore derives from one set of custom properties in
`globals.css`: `--safe-top/-bottom/-left/-right`, `--navbar-total`,
`--mobile-header-total`, `--tabbar-total`, `--fab-bottom`, `--app-content-h`.
Never hard-code `52px`, `56px`, or a bare `env()` in a component -- a bar sized
differently from the space reserved for it is how content ends up underneath it.

1. **The navbar offset is padding, never margin.** `mt-[52px]` on the desktop
   `<main>` collapsed straight out through `.app-canvas` and `<body>` -- nothing
   in that chain establishes a block formatting context -- so it landed on the
   root element instead of pushing content down inside the canvas. The document
   became 52px taller than the viewport, giving every page a phantom 52px of
   empty scroll; scrolling to the end slid the top of the page under the fixed
   navbar, which on a note hid the entire Back/actions row and sheared the title
   in half.
2. **Full-height means `dvh`, never `vh`.** `100vh` is the *large* viewport
   height: it keeps counting the status-bar band and any retractable browser
   toolbar. The sidebar sized at `calc(100vh - 52px)` ran past the bottom of the
   screen and took its Settings link with it -- rendered, never visible.
3. **A fixed bar adds its own inset.** `top: 0` is the top of the layout
   viewport, which is behind the status bar in the installed PWA. Each header
   sets `height: var(--*-total)` with `padding-top: var(--safe-top)`; box-sizing
   is border-box app-wide, so the declared height covers both.

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
| Calendar | `/calendar` | Month/week, drag to assign date, unscheduled tray |
| Account Settings | `/settings` | Profile tab + Appearance tab + Danger zone |

All authenticated routes live inside an App Shell with top navbar + sidebar (desktop)
or top header + bottom tab bar (mobile). Shell is in `src/app/(app)/layout.tsx`.

---

## App Shell Components

### Desktop

**Top Navbar** (52px, white, border-bottom 1px #e8ecf2)
- Left: Logo component (Y-mark + "ruang" wordmark, Newsreader 17px), navigates to /home
- Center-left: 4 nav tabs -- Home / Calendar / My Room / Search
  - Active tab: color #2c3848, font-weight 580, border-bottom 2.5px solid #A1B5D8
  - Inactive: color #9aaab8
- Right: keyboard shortcut button (?) + focus mode toggle (F) + autosave indicator (note only) + notification bell + avatar (32px, navigates to /settings)

**Left Sidebar** (default 280px, bg #f4f5f7, border-right 1px #e8ecf2, always visible unless focus mode)
- Resizable: drag handle on right edge. Range: 176-420px. Persists to `localStorage` key `ruang_sidebar_width`.
- Sections: PINNED (My Storeroom with green count badge) / SPACES (tree with + button) / Settings gear
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
- 4 tabs: Home / Calendar / My Room / Search
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
| To-do | POST /api/notes (type: checklist), navigate to /note/[id] |
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

### To-do (Checklist)
- Identical to Note but opens with a checklist (taskList) block pre-populated.
- Checklist item checked state: bg #A1B5D8, white tick, text line-through, color #b8c8d6.

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

Settings page (`/settings`) has two tabs: **Profile** and **Appearance**.

**Appearance tab options:**
- Accent color: 6 presets (Soft Blue, Sage, Sand, Rose, Plum, Slate). Applied live to CSS vars.
- Typography: Sans-serif / Serif (Newsreader).
- Theme: Light / Dark. **Dark is opt-in only -- never inherited from OS.** This is now a
  product choice, not a limitation: the dark palette is complete (see Theming below).
- Density: Compact / Comfortable / Spacious.
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
        CalendarView.tsx       -- interactive month/week calendar client component
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
    ui/                        -- shadcn/ui components
      DatePickerPopover.tsx    -- custom date picker popover
      avatar.tsx, badge.tsx, button.tsx, dialog.tsx, dropdown-menu.tsx,
      input.tsx, label.tsx, scroll-area.tsx, select.tsx, separator.tsx,
      tabs.tsx, textarea.tsx
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

### Phase 2 -- Polish and Power (not yet built)

- Automated reminder cron delivery (scheduled worker checks reminder_deliveries table)
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
