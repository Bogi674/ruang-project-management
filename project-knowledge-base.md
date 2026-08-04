# Ruang Project Knowledge Base
*Last updated: Aug 4, 2026 — reflects Phase 1 completion and all bug fixes*

---

## Database & Schema Reference

> **Schema files are the source of truth for column names and types.**
> This document covers product decisions, architecture intent, and confirmed bug-fix notes.
> Do not rely on this file for column-level detail — use `ruang_mvp_schema.sql` and
> `Ruang_database_structure.md` for that.

| File | Purpose |
|---|---|
| `ruang_mvp_schema.sql` | Full Supabase SQL: all CREATE TABLE, constraints, indexes, helper functions |
| `Ruang_database_structure.md` | Human-readable table + column reference |
| `CLAUDE.md` | Claude Code session context: architecture rules, confirmed bug fixes, API structure |

---

## Product Vision

A robust project management app with deep features, fast enough for quick notetaking with a
single tap on phone. Positioned between Notion (flexible content) and a lightweight PM tool
(project structure, reminders, team access).

Core differentiator: project-scoped journal where everything is anchored to a project, a date,
or both. Closest existing product is Agenda.app — this is the team version with full PM structure.

- Current goal: personal project first, built to be sellable later (multi-team, multi-workspace)
- Platform: desktop-first. PWA wrapper for mobile (installable, no separate native app)
- App name: **Ruang** (Indonesian for "space/room") — working name, not yet confirmed

---

## Core Architecture

```
Platform
└── Project
    └── Workstream
        └── Entry
            ├── Note
            ├── File
            ├── Task
            ├── Reminder
            └── Link
```

### Key data rules (do not change)

- Entry is a single polymorphic table with a `type` column and `content` JSONB
- Both `workstream_id` AND `project_id` are stored on every entry — even though workstream
  belongs to a project. This enables Today View and Calendar to query across projects without joins
- `pinned_date` and `pinned_date_end` on entries power the calendar/timeline view
- File metadata (R2 object key, bucket, mime type, size) is in the `files` table, linked to entry

---

## Confirmed Bug Fixes (Phase 1) — Do Not Revert

These bugs were found, fixed, and committed. Any future code generation must not re-introduce them.

### Bug 1: project_members row missing on project creation

**Problem:** `POST /api/projects` only inserted into `projects` but never inserted the creator
into `project_members`. `checkProjectAccess()` queries `project_members` for every permission
check — without that row, the creator cannot access their own project. The project appears
created in the DB but the UI shows "No projects yet".

**Fix:** `src/app/api/projects/route.ts` — after inserting into `projects`, always insert:
```ts
{ project_id: data.id, user_id: session.user.id, role: "owner" }
```

**Commit:** `3b5bb65`

---

### Bug 2: "admin" is not a valid role

**Problem:** Code generation initially used `role: "admin"`. The permission system in
`checkProjectAccess()` uses `["viewer", "editor", "owner"]`. Any string not in that array
resolves to `indexOf()` = -1, blocking every permission check silently.

**Fix:** Only ever use `"viewer"`, `"editor"`, or `"owner"` as role values.

---

### Bug 3: workstreams.created_by does not exist

**Problem:** `POST /api/workstreams` tried to insert `created_by: session.user.id`.
The `workstreams` table has no `created_by` column. This caused every workstream
creation to fail with a DB error.

**Fix:** Removed `created_by` from workstreams insert. Only `projects` and `entries`
tables have `created_by`.

**Commit:** `7fc0fde`

---

### Bug 4: files table — wrong column names

**Problem:** Multiple routes and the `FileRecord` type used:
- `size` — does not exist, correct column is `size_bytes`
- `storage_path` — does not exist, correct column is `r2_object_key`

Also, the files insert was missing `project_id`, `uploaded_by`, and `r2_bucket`.

**Fix:** All routes and types updated to use correct column names.
Affected files: `src/app/api/files/route.ts`, `src/app/api/files/[id]/route.ts`,
`src/app/api/entries/route.ts`, `src/app/api/entries/[id]/route.ts`,
`src/components/entries/EntryPanel.tsx`, `src/types/index.ts`.

**Commits:** `7fc0fde`, `5e8ea6b`

---

### Bug 5: note_versions table — wrong column names

**Problem:** `note_versions` insert used:
- `version_num` — does not exist, correct column is `version_number`
- `content` — does not exist, correct column is `content_snapshot`
- `created_by` — does not exist, correct column is `saved_by`

**Fix:** All three column names corrected in entry POST and PATCH handlers.

**Commit:** `7fc0fde`

---

### Bug 6: notifications table — wrong column names

**Problem:** `notifications` queries used:
- `user_id` — does not exist, correct column is `recipient_id`
- `read` — does not exist, correct column is `is_read`
Also, the `Notification` TypeScript interface had a `link` field that doesn't exist in the DB.

**Fix:** All corrected in `src/app/api/notifications/route.ts` and `src/types/index.ts`.

**Commit:** `7fc0fde`

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Frontend | Next.js 14 (App Router) | SSR, API routes, file handling |
| Auth | NextAuth.js + Google OAuth | Native remember-me + session config |
| Database | Supabase (PostgreSQL) | Auth and DB only — storage is NOT Supabase |
| File storage | Cloudflare R2 | S3-compatible API; presigned URLs for upload/download |
| RTE | TipTap | Open-source, Notion-like, extensible |
| Email | Resend | Simple API, good deliverability |
| Deployment | Vercel | Zero-config, free tier covers early usage |
| Scheduling | Vercel Cron (or BullMQ) | Reminder delivery jobs |
| Timeline Board | Custom CSS grid | Frozen left panel + scrollable date cols |
| Calendar toggle | FullCalendar.js | Traditional calendar view only |
| Drag to reschedule | dnd-kit | Horizontal drag across date columns |
| UI components | Tailwind + shadcn/ui | |
| PWA | next-pwa | Mobile installable wrapper |

---

## Feature Specification

### UAM & Auth

- Google OAuth login
- "Remember me" toggle (persistent vs session-only)
- Configurable session timeout per user (`session_timeout_minutes` on `users`)
- Three global roles: Admin (CRUD all users + all projects), Member (create/manage own projects,
  invite others), Viewer (read-only on shared projects)
- Three project-level roles: `"owner"` / `"editor"` / `"viewer"` — these are the ONLY valid values
- Project-level permission override (share a project with Viewer but allow comments)
- Invite by email (sends onboarding link via Resend)
- Admin can also create accounts directly

### Project Layer

- Name, description, status (Active / On Hold / Completed / Archived), color (user-assigned),
  cover/icon
- Progress bar (auto-calculated from tasks)
- Last activity timestamp
- Project pinning (top 3-5 in sidebar)
- Project-level members (separate from global UAM)

### Workstream Layer (within Project)

- Name, color, order, description
- Collapse/expand in sidebar and all views
- Unscheduled entry count badge
- No `created_by` — this column does not exist on the `workstreams` table

### Entry Types

**Note**
- Full TipTap RTE
- Supported blocks: H1-H3, paragraph, bullet list, numbered list, checklist (strikethrough on
  check), indentation, table, divider, callout block (colored + icon), code block
- Formatting: bold, italic, underline, strikethrough, superscript, subscript
- @mention sends in-app notification
- Version history (last 10-20 versions in `note_versions`, revertible)
- Export as PDF or plain text
- Note locking (prevent edits without unlocking)
- Initial version saved on creation; new version saved on each content PATCH

**File**
- Upload and attach files to a workstream
- 20MB per file limit (default)
- Preview: images inline, PDF embedded viewer, video HTML5 player, others icon + download link
- File description field per entry
- Download all files in project as ZIP
- File metadata in `files` table: `size_bytes`, `r2_object_key`, `r2_bucket`, `mime_type`
- NO file versioning

**Task**
- Title, status (To Do / In Progress / Blocked / Done), due date, assignee
- Status is a colored visual pill, not a text dropdown
- Overdue tasks pulse visually
- In-app notification only (no email for tasks)
- Assignable to any project member

**Reminder**
- One-time or recurring (daily, weekly, custom interval)
- Audience: just me, all project members, or specific people
- Type label: Deadline / Follow-up / Meeting / Review (affects email template)
- Email delivery via Resend
- In-app notification bell (notification list, not popup)
- NO snooze from email link

**Link**
- URL + title
- Auto-fetches OG metadata (image + description) for preview
- Optional short notes field

---

## Cloudflare R2 Integration

Supabase is used for auth and PostgreSQL only. All file uploads go to Cloudflare R2.

**Upload flow:**
1. Client requests presigned PUT URL from `/api/files/upload-url`
2. Client uploads file directly to R2 (no file data through Next.js server)
3. Client calls `/api/files` POST to save metadata to `files` table in Supabase

**Download / preview flow:**
1. Client calls `/api/files/[id]` GET
2. Route verifies access, generates short-lived presigned GET URL from R2
3. Client uses URL for inline preview or download

**Required env vars:**
```
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=
```

SDK: `@aws-sdk/client-s3` with endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
R2 lib: `src/lib/r2.ts` — functions: `uploadToR2`, `deleteFromR2`, `getR2PublicUrl`, `getR2SignedUrl`
Do not use the Supabase storage client anywhere in this project.

---

## Views

### Today View (default home screen)

Cross-project, cross-workstream aggregation of everything due or pinned to today.
Shows overdue items prominently. Grouped by project + workstream.
Gentle "Next Up" nudge for unscheduled items (text at bottom only, never a popup).

### List View (default inside a project)

Chronological feed of all entries in a project, grouped by date. Unscheduled entries float
to top as a collapsible "Unscheduled" section.

### Project Timeline Board (Calendar View — Phase 2 Priority 1)

Custom CSS grid — NOT FullCalendar. Architecture:
- Left frozen panel: project/workstream tree (collapsible rows, color-coded by project)
- Horizontal scrollable date columns (week view default, month/day toggle)
- Today column always highlighted in amber
- Entry chips: type icon + truncated label
- Chip color logic: note + file → project color; reminder → amber; link → purple;
  task → neutral; done task → green with strikethrough
- "+N more" badge when cell has more than 2 entries
- Hover on empty cell: faint "+ pin here" affordance
- Click chip: opens full entry as side panel (not new page)
- Drag chip to new date: reschedules via dnd-kit
- Filter by: all projects / single project / entry type / workstream
- "Unscheduled" sidebar drawer for entries with no `pinned_date`
- Collapse/expand project rows independently

### Kanban View — Phase 3

Status columns (To Do / In Progress / Blocked / Done). Drag cards between columns.

---

## ADHD-Friendly Design Principles

Applied throughout — product requirements, not optional polish:

1. Today View as default landing — never opens to blank project list
2. Inbox / Brain Dump Zone — catch-all with zero fields required
3. Quick Capture FAB — always-visible floating button, pre-fills current project + today, 2-tap to write
4. Focus Mode per workstream — one click hides everything else
5. Color before text — project color + workstream color chosen by user; eye finds context before reading
6. Visual status — colored pills, not text dropdowns; overdue items pulse
7. No mandatory fields — creating any entry requires only a name/title
8. "Next Up" nudge — low-pressure text at bottom of Today View only (not a popup)
9. Compact chips in Calendar — scan, don't read
10. Collapsed projects in Timeline — reduce cognitive load when focusing on one project

---

## Build Session Plan

| Session | Focus | Status |
|---|---|---|
| 1 | Foundation: schema + Next.js scaffold + NextAuth + Google OAuth + R2 env | Complete |
| 2 | Data layer: Project + Workstream CRUD + API routes + UAM + invite flow | Complete |
| 3 | Entry system: TipTap Note + File upload (R2 presigned URL) + Task entry | Complete |
| 4 | Views: List View + Today View + Quick Capture FAB | Complete |
| 5 | Calendar + Email: Project Timeline Board + Reminder email delivery | Phase 2 next |

**Phase 1 complete as of commit `5e8ea6b` (Aug 4, 2026).**

---

## Model Strategy

- **Sonnet 4.6** — default for all code generation (components, API routes, Supabase queries,
  TipTap config). Handles 80-90% of work.
- **Opus 4.8** — escalate only for: full DB schema design, complex architecture decisions,
  hard debugging that Sonnet can't solve
- In Claude Code: use `/model` to switch mid-session
- API calls inside the app: always use model string `claude-sonnet-4-6`

---

## Explicitly Cut Features (do not build, do not suggest)

- File versioning (re-upload under same entry to keep history)
- Snooze from email link in reminder emails
- Real-time collaborative editing (single-editor only)
- Activity log / audit trail
- External client access (internal team only)
- FullCalendar for the Timeline Board (custom CSS grid only)
- Email notifications for tasks (in-app only)
