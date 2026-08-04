# Ruang — Project Context for Claude Code

> This file is read automatically at every Claude Code session start.
> It reflects the CURRENT state of the codebase as of Phase 1 completion (Aug 2026).
> Full DB schema: `ruang_mvp_schema.sql` | Full table reference: `Ruang_database_structure.md`

---

## What This Is

Project management app positioned between Notion (flexible content) and a lightweight PM tool
(project structure, reminders, team access). Core differentiator: project-scoped journal where
everything is anchored to a project, a date, or both. Closest reference: Agenda.app — this is
the team version with full PM structure.

- Personal use first, architected to be sellable later (multi-team, multi-workspace)
- Desktop-first. Mobile via PWA wrapper (next-pwa) — no separate native app
- App name: **Ruang** (Indonesian for "space/room") — working name, not yet confirmed

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR, API routes, file handling |
| Auth | NextAuth.js + Google OAuth | Remember-me toggle + session config |
| Database | Supabase (PostgreSQL) | Auth and DB only — NOT used for file storage |
| File storage | Cloudflare R2 | S3-compatible; presigned URLs for upload/download |
| RTE | TipTap | Notion-like, extensible |
| Email | Resend | Reminder delivery |
| Deployment | Vercel | Zero-config |
| Scheduling | Vercel Cron (or BullMQ) | Reminder delivery jobs |
| Timeline Board | Custom CSS grid | Frozen left panel + scrollable date cols — NOT FullCalendar |
| Calendar toggle | FullCalendar.js | Traditional calendar view only |
| Drag to reschedule | dnd-kit | Horizontal drag across date columns |
| UI | Tailwind + shadcn/ui | |
| PWA | next-pwa | Mobile installable wrapper |

---

## Data Hierarchy

```
Platform
└── Project
    └── Workstream
        └── Entry (polymorphic)
            ├── note
            ├── file
            ├── task
            ├── reminder
            └── link
```

---

## Critical Rules — Read Before Writing Any Code

### 1. project_members must be created alongside every new project

When inserting a new project, ALWAYS immediately insert the creator into `project_members`
with role `"owner"`. Without this row, `checkProjectAccess()` returns null and the project
becomes completely inaccessible — the creator cannot read, edit, or even see their own project.

```ts
// After inserting into projects:
await db.from("project_members").insert({
  project_id: data.id,
  user_id: session.user.id,
  role: "owner",        // must be exactly "owner" | "editor" | "viewer"
});
```

### 2. Role strings are strict — no "admin"

`checkProjectAccess()` in `src/lib/api-helpers.ts` validates roles using:
```ts
const roles = ["viewer", "editor", "owner"];
roles.indexOf(data.role) >= roles.indexOf(minRole)
```
Using any other string (e.g. `"admin"`) results in `indexOf()` returning -1, which silently
blocks ALL permission checks — including read access. Valid values: `"viewer"` `"editor"` `"owner"`.

### 3. workstreams table has NO created_by column

The `workstreams` table does not have a `created_by` column. Do not insert it. Only `projects`
and `entries` tables have `created_by`.

### 4. Supabase storage is NOT used — all files go to Cloudflare R2

Never use `supabase.storage`. File upload flow:
1. Client uploads file to R2 via presigned PUT URL from `/api/files/upload-url`
2. Client saves metadata to `files` table via `/api/files` POST
3. Client gets file URL via presigned GET from `/api/files/[id]`

R2 lib is at `src/lib/r2.ts`. Functions: `uploadToR2`, `deleteFromR2`, `getR2PublicUrl`, `getR2SignedUrl`.

---

## Database Column Names — Verified Correct

These were the source of multiple bugs. Column names below are confirmed against
`ruang_mvp_schema.sql` and all API routes have been fixed to match.

### `files` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `public_id` | text | |
| `entry_id` | uuid | FK → entries |
| `project_id` | uuid | FK → projects (stored directly for ZIP queries) |
| `uploaded_by` | uuid | FK → users |
| `filename` | text | |
| `r2_object_key` | text | The R2 object key / path — NOT `storage_path` |
| `r2_bucket` | text | R2 bucket name |
| `mime_type` | text | |
| `size_bytes` | bigint | File size — NOT `size` |
| `description` | text | |
| `created_at` | timestamptz | |

**Common mistakes to avoid:**
- `size` does NOT exist → use `size_bytes`
- `storage_path` does NOT exist → use `r2_object_key`

### `note_versions` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `public_id` | text | |
| `entry_id` | uuid | FK → entries |
| `saved_by` | uuid | FK → users — NOT `created_by` |
| `content_snapshot` | jsonb | Full content at this version — NOT `content` |
| `version_number` | int4 | NOT `version_num` |
| `created_at` | timestamptz | |

**Common mistakes to avoid:**
- `created_by` does NOT exist → use `saved_by`
- `content` does NOT exist → use `content_snapshot`
- `version_num` does NOT exist → use `version_number`

### `notifications` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `public_id` | text | |
| `recipient_id` | uuid | FK → users — NOT `user_id` |
| `actor_id` | uuid | FK → users (who triggered it) |
| `entry_id` | uuid | FK → entries |
| `type` | text | |
| `message` | text | |
| `is_read` | bool | NOT `read` |
| `created_at` | timestamptz | |

**Common mistakes to avoid:**
- `user_id` does NOT exist → use `recipient_id`
- `read` does NOT exist → use `is_read`
- `link` does NOT exist (no link column on notifications)

### `workstreams` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `public_id` | text | |
| `project_id` | uuid | FK → projects |
| `name` | text | |
| `color` | text | |
| `sort_order` | int4 | |
| `description` | text | |
| `is_collapsed` | bool | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**Note:** NO `created_by` column on workstreams.

---

## API Routes — Current Structure

All routes live under `src/app/api/`. All use `requireAuth()` and `checkProjectAccess()` from
`src/lib/api-helpers.ts`. The service client bypasses RLS — permission checks are done manually
in every route handler.

### Projects

| Method | Route | Min role | Notes |
|---|---|---|---|
| GET | `/api/projects` | — | Lists projects via project_members join |
| POST | `/api/projects` | — | Creates project + inserts creator as owner in project_members |
| GET | `/api/projects/[id]` | viewer | Uses internal `id` UUID for lookup |
| PATCH | `/api/projects/[id]` | editor | Allows owner + editor |
| DELETE | `/api/projects/[id]` | owner | |
| GET | `/api/projects/[id]/members` | viewer | |
| POST | `/api/projects/[id]/members` | owner | Adds member or creates invitation |
| DELETE | `/api/projects/[id]/members` | owner | |

### Workstreams

| Method | Route | Min role | Notes |
|---|---|---|---|
| GET | `/api/workstreams?projectId=` | viewer | |
| POST | `/api/workstreams` | editor | Body: `{ projectId, name, description, color }` |
| GET | `/api/workstreams/[id]` | viewer | |
| PATCH | `/api/workstreams/[id]` | editor | Allowed fields: name, description, color, sort_order |
| DELETE | `/api/workstreams/[id]` | editor | |

### Entries

| Method | Route | Min role | Notes |
|---|---|---|---|
| GET | `/api/entries?projectId=&workstreamId=&type=&today=&limit=&offset=` | viewer | Returns with joined project, workstream, creator, assignees, files |
| POST | `/api/entries` | editor | Body: `{ projectId, workstreamId, type, content, pinnedDate, pinnedDateEnd, tags }` |
| GET | `/api/entries/[id]` | viewer | |
| PATCH | `/api/entries/[id]` | editor | Merges content; saves note_version on note content change |
| DELETE | `/api/entries/[id]` | editor | |

Entry POST body notes:
- `projectId` + `workstreamId` + `type` are required
- `content` is optional — route calls `getDefaultContent(type, content)` to merge with defaults
- The select in both GET and PATCH uses: `files(id, filename, size_bytes, mime_type, r2_object_key, created_at)`

### Files

| Method | Route | Min role | Notes |
|---|---|---|---|
| POST | `/api/files` | editor | multipart/form-data with `file` + `entryId` |
| GET | `/api/files/[id]` | viewer | Returns presigned R2 URL |
| DELETE | `/api/files/[id]` | editor | Deletes from R2 + DB |

File POST inserts: `entry_id`, `project_id`, `uploaded_by`, `filename`, `size_bytes`, `mime_type`,
`r2_object_key`, `r2_bucket`. References `entry.project_id` fetched from DB.

### Notifications

| Method | Route | Min role | Notes |
|---|---|---|---|
| GET | `/api/notifications?unread=true` | — | Filters by `recipient_id`; unread uses `is_read = false` |
| PATCH | `/api/notifications` | — | Body: `{ markAllRead: true }` sets `is_read = true` |

### Auth + Users

| Method | Route | Notes |
|---|---|---|
| ALL | `/api/auth/[...nextauth]` | NextAuth handler |
| GET + PATCH | `/api/users` | Current user profile |

---

## Permission System

`checkProjectAccess(db, projectId, userId, minRole)` in `src/lib/api-helpers.ts`:

```ts
const roles = ["viewer", "editor", "owner"];
if (roles.indexOf(data.role) < roles.indexOf(minRole)) return null;
```

- Returns the user's role string on success, `null` on failure
- Default `minRole` is `"viewer"` if not specified
- `minRole = "editor"` allows both `"editor"` AND `"owner"`
- `minRole = "owner"` allows only `"owner"`
- Any role string not in the array (e.g. "admin") returns index -1 → always blocked

---

## TypeScript Types (src/types/index.ts)

Key interfaces — these match the actual DB schema:

```ts
type ProjectMemberRole = "owner" | "editor" | "viewer";

interface FileRecord {
  id: string;
  entry_id: string;
  project_id: string;
  uploaded_by: string;
  filename: string;
  size_bytes: number;      // NOT size
  mime_type: string;
  r2_object_key: string;  // NOT storage_path
  r2_bucket: string;
  created_at: string;
}

interface Workstream {
  id: string;
  public_id: string;
  project_id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  // NO created_by
  created_at: string;
  updated_at: string;
}

interface Notification {
  id: string;
  recipient_id: string;   // NOT user_id
  actor_id: string | null;
  entry_id: string | null;
  type: string;
  message: string;
  is_read: boolean;       // NOT read
  created_at: string;
  // NO link column
}
```

---

## Entry Types

### Shared fields on every entry

```
id, public_id, type, project_id, workstream_id, created_by,
pinned_date (date), pinned_date_end (date), tags (jsonb array),
content (jsonb), is_pinned, created_at, updated_at
```

### Content shapes by type

**note**
```json
{ "title": "", "tiptap_json": {}, "is_locked": false, "version_number": 1 }
```
Initial note version saved to `note_versions` on POST:
`{ entry_id, version_number: 1, content_snapshot: <content>, saved_by: userId }`
Subsequent saves on PATCH also write to `note_versions`. Keep last 20.

**task**
```json
{ "title": "", "status": "todo", "due_date": null }
```
Status values: `todo` | `in_progress` | `blocked` | `done`

**file**
```json
{ "title": "", "description": "" }
```
Actual file metadata in `files` table (linked via `entry_id`).

**reminder**
```json
{
  "title": "",
  "type_label": "deadline",
  "schedule_type": "one_time",
  "scheduled_at": null,
  "recurrence": null,
  "audience_type": "just_me",
  "recipient_ids": []
}
```
`type_label`: `deadline` | `follow_up` | `meeting` | `review`
`schedule_type`: `one_time` | `recurring`
`audience_type`: `just_me` | `all_members` | `specific`

**link**
```json
{ "url": "", "title": "", "og_image": null, "og_description": null, "notes": "" }
```

---

## File Structure

```
src/
├── app/
│   ├── (app)/
│   │   ├── layout.tsx              — app shell wrapper
│   │   ├── today/page.tsx          — Today View (default home)
│   │   └── projects/
│   │       ├── page.tsx            — All Projects list
│   │       └── [id]/
│   │           ├── page.tsx        — Project detail (List View)
│   │           └── settings/page.tsx
│   ├── api/
│   │   ├── auth/[...nextauth]/     — NextAuth handler
│   │   ├── projects/
│   │   │   ├── route.ts            — GET list, POST create (+ project_members insert)
│   │   │   └── [id]/
│   │   │       ├── route.ts        — GET, PATCH, DELETE
│   │   │       └── members/route.ts
│   │   ├── workstreams/
│   │   │   ├── route.ts            — GET list, POST create (no created_by)
│   │   │   └── [id]/route.ts
│   │   ├── entries/
│   │   │   ├── route.ts            — GET list, POST create
│   │   │   └── [id]/route.ts       — GET, PATCH (saves note_versions), DELETE
│   │   ├── files/
│   │   │   ├── route.ts            — POST upload to R2 + save metadata
│   │   │   └── [id]/route.ts       — GET presigned URL, DELETE from R2 + DB
│   │   ├── notifications/route.ts  — GET (recipient_id, is_read), PATCH (markAllRead)
│   │   └── users/route.ts
│   ├── auth/signin/page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── components/
│   ├── editors/TipTapEditor.tsx
│   ├── entries/
│   │   ├── EntryCard.tsx
│   │   ├── EntryPanel.tsx          — uses file.size_bytes (not file.size)
│   │   ├── EntryTypeIcon.tsx
│   │   ├── QuickCapture.tsx
│   │   └── StatusPill.tsx
│   ├── layout/AppShell.tsx
│   ├── projects/ProjectForm.tsx
│   ├── workstreams/WorkstreamForm.tsx
│   └── ui/                         — shadcn/ui components
├── lib/
│   ├── api-helpers.ts              — requireAuth, checkProjectAccess, error helpers
│   ├── auth.ts                     — NextAuth config
│   ├── r2.ts                       — uploadToR2, deleteFromR2, getR2PublicUrl, getR2SignedUrl
│   ├── supabase.ts                 — createServiceClient (bypasses RLS)
│   └── utils.ts
└── types/index.ts                  — All TypeScript interfaces
```

---

## Cloudflare R2 Integration

File upload flow (presigned URL pattern):
1. Client requests presigned PUT URL from `/api/files/upload-url`
2. Client uploads directly to R2 — no file data through Next.js server
3. Client saves metadata to `files` table via `/api/files` POST

File read flow:
1. Client calls `/api/files/[id]` GET
2. Route verifies access, generates presigned GET URL
3. Client uses URL for inline preview or download

R2 env vars required:
```
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=
```
SDK: `@aws-sdk/client-s3` with endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
Never use Supabase storage client anywhere in this project.

---

## Build Phase Status

**Phase 1 — COMPLETE**

Auth + UAM, Project CRUD, Workstream CRUD, Note (TipTap), File (R2), Task, List View, Today View.

**Phase 2 — Next**

Reminder + email delivery (Resend), Link entry, Quick Capture FAB, Project Timeline Board,
Entry filters.

**Phase 3**

Kanban View, Focus Mode, Tags, PWA wrapper, Code block + Callout TipTap extensions,
@mention with notification.

---

## Views to Build (Phase 2+)

### Project Timeline Board (Priority 1 in Phase 2)

Custom CSS grid — NOT FullCalendar. Architecture:
- Left panel frozen: project/workstream tree, collapsible rows, color-coded
- Horizontal scrollable date columns (week default; day/month toggle)
- Today column highlighted amber
- Entry chips: type icon + truncated label
- Chip colors: note/file → project color; reminder → amber; link → purple; task → neutral; done task → green strikethrough
- "+N more" badge beyond 2 entries per cell
- Hover empty cell: "+ pin here" affordance
- Click chip: opens side panel
- Drag chip: reschedules via dnd-kit
- Unscheduled sidebar drawer

### Today View (exists, may need polish)

Cross-project aggregation of everything pinned to today. Groups by project + workstream.
"Next Up" nudge at bottom for unscheduled items.

---

## ADHD-Friendly Design Rules (Product Requirements)

1. Today View is always the default landing — never blank project list
2. Inbox / Brain Dump Zone: zero required fields
3. Quick Capture FAB: always visible, pre-fills current project + today
4. Focus Mode per workstream: hides everything else
5. Color before text: project + workstream colors user-assigned
6. Visual status pills, never text dropdowns; overdue tasks pulse
7. No mandatory fields — any entry only requires a title
8. "Next Up" nudge at bottom of Today View only (not a popup)
9. Compact chips in Calendar — scan, don't read
10. Collapsed project rows in Timeline reduce cognitive load

---

## Do Not Build (Explicitly Cut)

- File versioning (re-upload under same entry instead)
- Snooze from email link in reminder emails
- Real-time collaborative editing (single-editor only)
- Activity log / audit trail
- External client access (internal team only)
- FullCalendar for Timeline Board (custom CSS grid only)
- Email notifications for tasks (in-app only)

---

## Model Strategy

- **claude-sonnet-4-6** — default for all code generation
- **claude-opus-4-8** — escalate only for DB schema design, hard architecture decisions, deep bugs
- Switch mid-session in Claude Code with `/model`
- API calls from inside the app: model string `claude-sonnet-4-6`

---

## Session Starter Prompt

Paste at top of each new Claude Code session:

```
Building Ruang: Next.js 14 App Router + TypeScript + Supabase (PostgreSQL + Auth only)
+ Cloudflare R2 (all file storage, never Supabase storage) + TipTap + NextAuth + Resend
+ Tailwind + shadcn/ui. Deployed on Vercel.

Hierarchy: Platform > Project > Workstream > Entry
Entry types: note / file / task / reminder / link

CRITICAL — always do this when creating a project:
After inserting into projects, immediately insert the creator into project_members
with role "owner". Without this, checkProjectAccess() returns null and the project
is invisible and inaccessible.

CRITICAL — column names that have caused bugs before (do not revert):
- files table: size_bytes (NOT size), r2_object_key (NOT storage_path)
- note_versions table: version_number (NOT version_num), content_snapshot (NOT content), saved_by (NOT created_by)
- notifications table: recipient_id (NOT user_id), is_read (NOT read)
- workstreams table: NO created_by column

Valid project member roles: "owner" | "editor" | "viewer" only.
"admin" is not a valid role and will silently break all permission checks.

Refer to CLAUDE.md, ruang_mvp_schema.sql, and Ruang_database_structure.md for all details.

Today: [specific feature to build]
```
