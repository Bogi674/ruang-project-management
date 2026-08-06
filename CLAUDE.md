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
| Database | Supabase (PostgreSQL) | DB and auth ONLY — never file storage |
| File storage | Cloudflare R2 | All file bytes. S3-compatible, presigned URLs |
| RTE | TipTap | Block-based editor with slash commands |
| Email | Resend | Reminder delivery (Phase 2) |
| Deployment | Vercel | Zero-config |
| UI | Tailwind CSS + shadcn/ui | |
| PWA | next-pwa | Mobile installable |

**Repo:** `github.com/Bogi674/ruang-project-management`, branch `main`
**Deployment:** `ruang-project-management.vercel.app`

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
  created_at

spaces
  id, name, color, icon (emoji), owner_id,
  parent_id (nullable -- null = top-level space),
  path (materialized text, e.g. "work/design/ui-research"),
  depth (0-2, max 3 levels enforced in DB and UI),
  is_shared, created_at

notes
  id, user_id,
  type (note | checklist),
  title (auto-derived from first line of content -- never set by user),
  content (TipTap JSON),
  space_id (nullable -- null = lives in My Storeroom),
  tags (jsonb array),
  pinned_date (date, nullable),
  pinned_date_end (date, nullable),
  is_pinned_to_home (bool),
  is_public (bool, Phase 3 only),
  published_at (nullable, Phase 3 only),
  created_at, updated_at

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
  "date": null,
  "time": null,
  "recurrence": "once",
  "type_label": "Deadline | Follow-up | Meeting | Review"
}
```

**File:**
```json
{ "description": "" }
```
(Actual file stored in R2. Metadata in `files` table linked via `widget_id`.)

**Link:**
```json
{
  "url": "",
  "og_title": "",
  "og_description": "",
  "og_image": null,
  "note": ""
}
```

---

## Critical Rules — Read Before Writing Any Code

### 1. Supabase is DB and auth ONLY — never file storage

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

### 2. Note titles are never user-entered

The `title` column on `notes` is auto-derived from the first line of `content` (TipTap JSON).
There is no title field in the UI. The editor opens with a blank cursor. First line = title.
Sync the derived title to the DB on each autosave.

### 3. Spaces have a maximum depth of 3 levels (depth 0, 1, 2)

- `depth: 0` = top-level space (no parent)
- `depth: 1` = child of a top-level space
- `depth: 2` = grandchild (maximum allowed depth)

Enforce this in both DB constraint and UI (hide "New sub-space" option at depth 2).
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

---

## Autosave Architecture (Hybrid Sync)

This is a deliberate middle-path decision. Full offline-first (IndexedDB + service worker +
conflict resolution) was explicitly ruled out as too complex. The chosen approach:

**Every keystroke:** Write TipTap content to `localStorage` immediately. Key: `ruang_draft_${noteId}`.
**1.5 seconds after last keystroke:** Debounced Supabase sync fires (PATCH `/api/notes/[id]`).
**On sync failure:** Retry silently up to 3 times with exponential backoff.
**On app open:** Load last `localStorage` state immediately while fresh DB data fetches behind it.
**PWA:** Installable, but online required for sync. localStorage covers "bad wifi" scenarios.

Sync indicator states (top navbar on desktop, below date line on mobile):
- **Typing:** indicator hidden
- **Syncing:** subtle spinner + "Saving..."
- **Synced:** "Saved" text, fades after 2 seconds
- **Error:** "Couldn't save — check connection" (persistent, never auto-dismiss)

There is no save button anywhere in the app.

Draft cleanup: remove `localStorage` key after successful Supabase sync.

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

/* Danger: Orange (destructive actions only) */
--danger:            #F08050;
--danger-dark:       #E06830;
--danger-bg:         #fff4ee;
--danger-border:     #f8c8a8;
```

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
Sidebar width:              208px
Top navbar height:          52px (desktop), 56px (mobile)
Bottom tab bar height:      64px (mobile, safe-area bottom padding)
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
| Calendar | `/calendar` | Month/week, drag to assign date |
| Account Settings | `/settings` | Profile, password, connected accounts, danger zone |

All authenticated routes live inside an App Shell with top navbar + sidebar (desktop)
or top header + bottom tab bar (mobile).

---

## App Shell Components

### Desktop

**Top Navbar** (52px, white, border-bottom 1px #e8ecf2)
- Left: logo mark + wordmark "ruang" (Newsreader 17px), navigates to /home
- Center-left: 4 nav tabs -- Home / Calendar / My Room / Search
  - Active tab: color #2c3848, font-weight 580, border-bottom 2.5px solid #A1B5D8
  - Inactive: color #9aaab8
- Right: autosave indicator (inside note only) + notification bell + avatar (32px, navigates to /settings)

**Left Sidebar** (208px, bg #f4f5f7, border-right 1px #e8ecf2, always visible in MVP)
- Sections: PINNED (My Storeroom with green count badge) / SPACES (tree with + button) / Settings gear
- Space color dots: level 1 = 7px, level 2 = 6px, level 3 = 5px dot
- Active item: bg #dce8f6, color #4a6090, font-weight 580
- Sidebar is NOT collapsible in Phase 1

### Mobile

**Top Header** (56px, white, border-bottom 1px #e8ecf2)
- Default: hamburger left, logo center, bell + avatar right
- Inside note editor: back chevron left, note title center, overflow menu right

**Bottom Tab Bar** (64px, white, border-top 1px #e8ecf2, safe-area bottom)
- 4 tabs: Home / Calendar / My Room / Search
- Each: icon (SVG 20px) + label (10px), inactive #9aaab8, active #4a6090
- Hidden when note editor is open (editor is full-screen)

**Left Drawer** (280px, slides from left, slideLeft 0.22s, backdrop closes on tap)
- Contents: My Storeroom / Spaces tree / Settings / Profile footer

---

## FAB (Floating Action Button)

- Circle, 52-54px, bg #A1B5D8, white + icon
- Desktop: fixed bottom 28px, right 28px, z-index 51
- Mobile: fixed bottom 80px, right 20px, z-index 30
- Open state: rotate 45deg, bg #738290
- Popup: desktop = fixed card above FAB (bottom 90px, right 28px); mobile = bottom sheet

5 items in create menu:
| Label | Action |
|---|---|
| Note | Navigate to /note/new |
| To-do | Navigate to /note/new?type=checklist |
| Reminder | Navigate to /note/new, pre-attach Reminder widget |
| File Upload | Navigate to /note/new, pre-attach File widget |
| Link / Bookmark | Navigate to /note/new, pre-attach Link widget |

---

## Widget System

Widgets live in an "Attached Widgets" zone BELOW the TipTap note body. Never inline in prose.
A widget with `note_id = null` is standalone (appears in Home > Upcoming, My Storeroom).

Entry points to add a widget:
1. "Add" button in the formatting toolbar inside the note editor
2. FAB create menu (Reminder, File Upload, Link/Bookmark)

Widget Picker modal: 480px centered desktop / bottom sheet mobile.
3 option cards with icon wells: Reminder (#edf3fa bg) / File (#f4faf0 bg) / Link (#edf3fa bg).

---

## Content Types

### Note
- Opens with blinking cursor (#A1B5D8 animated bar). No fields required.
- First line auto-becomes title.
- TipTap RTE. Slash commands via `/`.
- Supported blocks: H1/H2/H3, paragraph, bullet list, numbered list, checklist, code block, callout, divider.

### To-do (Checklist)
- Identical to Note but opens with a checklist block pre-populated.
- Checklist item checked state: bg #A1B5D8, white tick, text line-through, color #b8c8d6.

---

## Organization System

### Spaces
- Optional. A note with no space is valid (lives in My Storeroom).
- Max depth: 3 levels. Enforced in DB and UI.
- Each space: name, color, emoji icon.
- Moving a space re-nests all child spaces (update path for all descendants).

### Tags
- Flat labels, JSONB array on `notes`.
- User-created, color-coded.
- Tag chip styles: green `.tag-chip` (#E4F0D0 bg, #4a6a40 text) or blue `.tag-chip-blue` (#dce8f6 bg, #4a6090 text).

### Dates
- Any note or widget can have a `pinned_date` and optional `pinned_date_end`.
- Date assigned = item appears on Calendar.
- No date = stays in My Storeroom / Recent only.

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

These define the Ruang feel. Get these right.

1. **FAB expand** -- rotate + color change + popup card above, smooth 0.15s
2. **Note card to full-screen** -- fadeUp animation (translateY 8px to 0), feels like card expanding
3. **Autosave indicator** -- "Saved" appears quietly and fades in 2s; never alarming
4. **Checking off checklist item** -- checkbox fills #A1B5D8, text strikes through (subtle transition)
5. **Slash command picker** -- inline, keyboard-navigable, closes on Escape
6. **Dragging note onto calendar** -- visual drag from unscheduled tray, date cell highlights on hover
7. **Widget picker opening** -- backdrop blur + modal slides in
8. **Left drawer (mobile)** -- slideLeft 0.22s, backdrop tap closes
9. **Today cell (calendar)** -- #A1B5D8 circle date number, blue outline on cell
10. **Blinking cursor (empty note)** -- #A1B5D8 animated bar, welcoming not intimidating

---

## Phase Roadmap

### Phase 1 -- Core (current build target)

- Auth (email/password + Google OAuth)
- Note + To-do (checklist) creation and editing
- Autosave with localStorage draft cache + Supabase sync
- Widgets: Reminder, File Attachment, Link Preview (standalone + attached)
- Widget picker modal / bottom sheet
- Spaces (nestable max 3 levels)
- Tags
- Home dashboard (Pinned + Recent + Upcoming)
- My Storeroom
- My Room (Today's Focus + Pinned Notes + Quick Links + Coming Up)
- Calendar (month + week, drag to assign date, unscheduled tray)
- Search (full-text, recent searches)
- Account Settings (profile, password, Google connected, log out, delete account)
- Notification bell (in-app, badge count)
- FAB create menu (5 items)
- Desktop nav (top navbar + persistent sidebar)
- Mobile nav (bottom tab bar + left drawer + FAB)
- PWA installable

### Phase 2 -- Polish and Power

- Reminder email delivery (Resend)
- Note version history (last 20 versions, revertible)
- Note locking (prevent edits without unlocking)
- Export note as PDF or plain text
- Space sharing (invite by email, viewer/editor roles)
- Focus mode (hides everything except current space)
- Keyboard shortcuts reference panel
- User personalization (accent color, typography, surface texture, density, landing page, theme)

### Phase 3 -- Public Layer

- Public Ruang page (`ruang.app/[username]`)
- Publish individual notes
- Threaded note replies
- Follow a user's Ruang page
- Custom domain for public page

---

## Intended File Structure

```
src/
  app/
    (app)/
      layout.tsx               -- App Shell (navbar + sidebar + FAB)
      home/page.tsx            -- /home (Pinned + Recent + Upcoming)
      note/
        new/page.tsx           -- /note/new (blank note, optional ?type=checklist)
        [id]/page.tsx          -- /note/[id] (existing note)
      storeroom/page.tsx       -- /storeroom
      room/page.tsx            -- /room
      search/page.tsx          -- /search
      calendar/page.tsx        -- /calendar
      settings/page.tsx        -- /settings
    api/
      auth/[...nextauth]/      -- NextAuth handler
      notes/
        route.ts               -- GET list, POST create
        [id]/route.ts          -- GET, PATCH (autosave), DELETE
      spaces/
        route.ts               -- GET list, POST create
        [id]/route.ts          -- GET, PATCH, DELETE
      widgets/
        route.ts               -- GET list, POST create
        [id]/route.ts          -- GET, PATCH, DELETE
      files/
        upload-url/route.ts    -- GET presigned PUT URL for R2
        route.ts               -- POST save metadata
        [id]/route.ts          -- GET presigned GET URL, DELETE
      notifications/route.ts   -- GET, PATCH (mark read)
      users/route.ts           -- GET + PATCH current user
    login/page.tsx
    layout.tsx
    page.tsx                   -- redirect to /home or /login
    providers.tsx
  components/
    editor/
      TipTapEditor.tsx         -- main RTE component
      SlashCommands.tsx        -- / command picker
    notes/
      NoteCard.tsx             -- card for Home + Storeroom
      NoteRow.tsx              -- row item for list views
    widgets/
      WidgetPicker.tsx         -- modal/sheet for adding widgets
      ReminderWidget.tsx
      FileWidget.tsx
      LinkWidget.tsx
    layout/
      AppShell.tsx
      Sidebar.tsx
      TopNavbar.tsx
      MobileTabBar.tsx
      MobileDrawer.tsx
      FAB.tsx
    ui/                        -- shadcn/ui components
  lib/
    supabase.ts                -- createServiceClient (never use for file storage)
    r2.ts                      -- uploadToR2, getR2PresignedPutUrl, getR2SignedUrl, deleteFromR2
    auth.ts                    -- NextAuth config
    autosave.ts                -- localStorage draft cache + debounced Supabase sync
    api-helpers.ts             -- requireAuth, error helpers
    utils.ts
  types/index.ts               -- all TypeScript interfaces
```

---

## Cloudflare R2 Integration

```typescript
// lib/r2.ts -- required functions
getR2PresignedPutUrl(key: string, contentType: string): Promise<string>
getR2SignedUrl(key: string): Promise<string>
deleteFromR2(key: string): Promise<void>

// SDK: @aws-sdk/client-s3
// Endpoint: https://<CLOUDFLARE_ACCOUNT_ID>.r2.cloudflarestorage.com
// Never use supabase.storage anywhere
```

---

## Mobile-Specific Requirements

- PWA installable (manifest + service worker)
- All primary actions reachable without scrolling to top
- Note editor: full-screen overlay, keyboard-aware layout
- Formatting toolbar: 44px height, overflow-x auto, no scrollbar, docked above keyboard
- Widget picker: bottom sheet only (not center modal)
- No hover states; all interactions are tap or long-press
- Calendar: month grid only (no unscheduled tray; access via My Storeroom)
- Safe-area insets on bottom tab bar (iOS home indicator)
- Drawer: swipe-right-to-close gesture (optional but recommended)

---

## Session Notes for Claude Code

- For GitHub push: use Classic PAT with `repo` scope embedded in remote URL:
  `git remote set-url origin https://<PAT>@github.com/Bogi674/ruang-project-management.git`
- Shell paths with `(app)` directory require escaping: `src/app/\(app\)/...`
- Default model: `claude-sonnet-4-6`. Escalate to `claude-opus-4-8` for complex architecture decisions.
- Build warning suppression: set `NPM_FLAGS=--loglevel=error` in Vercel env vars (silences ESLint 8 deprecation warnings)
- Design reference files in project root: `Ruang_Prototype_dc.html` (desktop), `Ruang_Mobile_dc.html` (mobile)
  -- open via local server with `support.js`. These are the source of truth for visual implementation.

---

## Session Starter Prompt

Paste this at the top of each new Claude Code session:

```
Building Ruang v1.0 -- a note-first personal workspace. NOT the old PM tool.
Stack: Next.js 14 App Router + TypeScript + Supabase (DB + auth only, NEVER file storage)
+ Cloudflare R2 (all file bytes) + TipTap RTE + NextAuth (Google OAuth) + Tailwind + shadcn/ui.
Deployed on Vercel.

Key architecture decisions (locked):
- No Projects concept. Organization via Spaces only (nestable, max 3 levels).
- Content types: Note, Checklist (same as Note with checklist block pre-loaded).
- Widgets (Reminder, File, Link) attach BELOW note body -- never inline in prose.
- Autosave: every keystroke to localStorage, debounced 1.5s to Supabase. No save button.
- Note title = auto-derived from first line of content. No title field in UI.
- note.space_id = null means the note lives in My Storeroom (not a real DB entity).
- All file bytes go to R2. Never supabase.storage. r2_object_key stored in files table.

Refer to CLAUDE.md for full context, design tokens, data model, and critical rules.

Today's task: [specific feature to build]
```
