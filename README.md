# Ruang

**Ruang** (Indonesian for "space" or "room") is a note-first personal workspace web app.

**Core promise:** Open the app, start writing. Nothing mandatory. Organize when you feel like it.

Deployed at → **[ruang-project-management.vercel.app](https://ruang-project-management.vercel.app)**

---

## Stack

| Layer | Tool |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript |
| Auth | NextAuth.js — Google OAuth + email/password |
| Database | Supabase (PostgreSQL) — DB and auth only |
| File storage | Cloudflare R2 — all file bytes, presigned URLs |
| Rich text editor | TipTap v3 — block-based, extensible |
| Email | Resend — reminder delivery |
| Deployment | Vercel |
| Styling | Tailwind CSS — custom design tokens, no component library |
| PWA | Native manifest — installable on mobile, no next-pwa |

---

## Version History

### Legacy — Old PM Tool *(deprecated)*

The project began as a conventional project management tool organized around a four-level hierarchy: **Platform → Project → Workstream → Entry**. It had a traditional sidebar, project boards, and structured task tracking. The architecture proved too rigid for personal use and was completely deprecated in favor of a note-first redesign.

---

### v1.0 — Ruang Core Rebuild *(Aug 6–7, 2026)*

A clean rebuild from scratch under a new philosophy: capture first, organize never (or later). Everything from the old PM tool was removed.

**What shipped:**
- New data model: `users`, `spaces`, `notes`, `widgets`, `files`, `reminder_deliveries`, `notifications`
- Auth: email/password + Google OAuth via NextAuth
- TipTap v3 rich-text editor with autosave — every keystroke to `localStorage`, debounced 1.2 s to Supabase. No save button anywhere.
- **Spaces** — nestable folders, max 3 levels deep, with color + emoji per space
- **My Storeroom** — notes with no space assigned live here (not a real DB entity, just a filter)
- **Home** — Pinned notes + Recent + Upcoming reminders
- **My Room** — Today's focus + pinned notes + coming up
- **Calendar** — monthly grid with note assignment by drag
- **Search** — full-text
- **Widgets** — Reminder, File Attachment, Link/Bookmark — attached below the note body, never inline in prose; two-step creation flow (type picker → form); nothing written until "Add to Note"
- App shell: desktop top navbar + resizable sidebar (280 px default, 176–420 px, persists); mobile bottom tab bar + left drawer + FAB
- FAB with 5 create actions — creates the note first, deep-links to `?widget=` for widget setup
- PWA manifest + icons (192 × 192, 512 × 512), installable on mobile
- `.env.example` with all required environment variables

**Schema:** `supabase_schema.sql` (core tables, RLS, triggers)

---

### v1.1 — Personalization & Phase 2 *(Aug 7, 2026)*

**What shipped:**
- **Note locking** — `is_locked` column; locked notes are read-only in the editor; lock/unlock button in the toolbar
- **Version history** — `note_versions` table; last 20 checkpoints; right-side panel with one-click restore; "Save version" button triggers a manual checkpoint
- **Export** — Markdown and plain-text download via `lib/export.ts`; walks the full TipTap JSON tree
- **Reminder email** — Resend integration; `sendReminderEmail()` and `sendVerificationEmail()` in `lib/resend.ts`; manual trigger via `POST /api/reminders/send`
- **Appearance settings** — accent color (6 presets), typography (sans / serif), theme (light / dark opt-in), density, landing page preference
- Logo redesign: Y-mark + "ruang" wordmark as PNG assets (dark-ink + reversed white cuts)
- Sign-up page, password change endpoint
- Hardened RLS policies; fixed Google OAuth duplicate insert bug

**Schema:** `supabase_schema_phase2.sql` — `notes.is_locked`, `note_versions` table + RLS

---

### v1.2 — UI Polish & Calendar *(Aug 7–8, 2026)*

Iterative polish pass across the whole app, driven by real-use feedback.

**What shipped:**
- Delete notes and spaces; pin spaces to sidebar; space note counts
- Calendar multi-view (month / week); loading skeletons throughout
- Fixed duplicate notes, date formatting, favicon; improved Google auth detection
- Logo: full mark + wordmark lockup in navbar; PNG files organized under `public/logo/`
- Fixed widget duplication; calendar redesigned with an unscheduled tray on the right
- Updated FAB icons
- **React Strict Mode fix** — all note and widget creation moved to click handlers in `FAB.tsx`, never `useEffect` (prevented double-creation in dev and Strict Mode)
- Editor toolbar overhaul; dedicated space pages (`/space/[id]`)
- Note drag-to-space: drag a note card over a sidebar space row to reassign it; custom MIME type `application/x-ruang-note`
- Autosave hardening: retry on failure, `flushNote()` on `beforeunload` + `visibilitychange`
- PWA / mobile fixes: tab bar safe-area insets, calendar layout, editor toolbar on mobile
- Half-dark theme bug fixed; toolbar flattened; mobile tab bar sizing corrected

---

### v1.3 — Widget System, Theming & Dark Mode *(Aug 10–11, 2026)*

The widget system was rebuilt end-to-end and the theming architecture was locked in.

**What shipped:**
- **Full widget system** — `WidgetPicker` (two-step: type list → form); `ReminderForm`, `FileForm`, `LinkForm`; display components `ReminderWidget`, `FileWidget`, `LinkWidget`; "Add" button seated in the formatting toolbar
- Icon rework across the whole app; date picker popover rebuilt and functional
- Sidebar inline note lists (`SpaceNoteList`) — expand a space in the sidebar to see its notes
- **Per-space color theming** — `lib/spaceColor.ts` derives chip background, text, and border from the space's hex color; WCAG-AA compliant
- **App background graphics** — Plain / Dots / Grid / Diagonal / Rings / Glow; applied to the app canvas behind dashboards, never the note editor
- **Page tint** — Neutral / Warm / Cool / Mint / Blush / Accent
- Note surfaces (per-space theming in ProseMirror)
- `lib/theme.ts` established as the single source of truth for all preference resolution — used identically on the server (`layout.tsx`) and client (`applyPreferences()`); two caches: `ruang_theme_cache` for the blocking pre-paint script, `ruang_prefs` for React
- **Complete dark mode** — opt-in only, never inherited from OS; `Logo.tsx` renders both cuts and CSS hides one based on `data-theme` on `<html>`, so there is no JS flash
- **Security review** — fixed cross-tenant writes (missing `user_id` filters), SSRF redirect bypass, added security headers; `lib/ownership.ts` and `lib/ratelimit.ts` introduced

**Schema:** `supabase_schema_phase3.sql` — `app_background_preference`, `background_tint_preference`; `supabase_schema_phase4.sql` — RLS hardened on all 8 tables, `anon`/`authenticated` access to `public` schema revoked

---

### v1.4 — Mobile Hardening & Theme Persistence *(Aug 12–14, 2026)*

**What shipped:**
- **WhatsApp paste fix** — preserve TipTap formatting when copying to WhatsApp
- **Mobile toolbar docked above keyboard** — `lib/keyboardInset.ts` publishes `--kb-inset` on `<html>` via the Visual Viewport API (required because iOS does not resize the layout viewport when the keyboard opens); `ToolbarButton` calls `preventDefault()` on `mousedown` to keep the editor focused; `.docked-toolbar-gap` reserves space so the last line is not hidden under the bar
- **Theme persistence fix** — dark mode was resetting to light on every PWA cold start; `PreferencesProvider` no longer paints `defaultPreferences` over a cached theme; a rejected `PATCH /api/users` now rolls back the change and surfaces `saveError` in the Appearance tab
- Email verification sent via Resend on signup (not through Supabase SMTP); fallback to pre-confirmed account if Resend is unavailable
- Reversed logo shown in dark mode; `overscroll-behavior: none` on `html`/`body` and all long-lived inner scrollers to kill the elastic bounce gap

**Schema:** `supabase_schema_phase5.sql` — rebuilt appearance `CHECK` constraints unconditionally (drops and recreates) so earlier databases with stale constraint names are corrected

---

### v1.5 — Schema & Shell Hardening *(Aug 18, 2026)*

**What shipped:**
- Shell scroll bug fixed — the app canvas no longer scrolls the document
- "Add Widget" button permanently seated in the formatting toolbar
- Dark mode: neutralized remaining half-dark artifacts
- Appearance tab now names the reason a setting failed to save
- Rebuilt drifted `CHECK` constraints on appearance columns

**Schema:** `supabase_schema_phase6.sql` — pins `search_path` on every schema function; revokes `EXECUTE` on schema functions from `PUBLIC` (closes a PostgREST RPC exposure for `SECURITY DEFINER` functions)

---

### v1.6 / Phase 7 — First-class To-dos *(Aug 18–24, 2026)*

The largest single feature addition. To-dos are a first-class entity (`todos` rows), not notes.

**What shipped:**
- `todos` table — `parent_id` (sub-tasks, one level), `due_date` + `due_time` (independent nullable columns), fractional `position` ordering, `subtask_mode`, `recurrence`, `reminder`, `source_note_id`
- `todo_attachments` table — `kind: file | note`, enforced by CHECK
- Seven `users.todo_*` preference columns
- **`/todo` screen** — Today / Week / Month / All views; list only (the calendar lives at `/calendar`)
- **Quick add** everywhere — sticky bar, per-group inline row, Unassigned column, mobile sheet, FAB; typed date and duration parsing ("fri 3pm", "~20m") echoed as dismissible chips
- **Drag and drop** — Pointer Events (not HTML5 DnD); works on touch; cross-date reordering; drops onto any `/calendar` cell or the Unassigned tray; `Ctrl/Cmd + ↑/↓` from keyboard; ghost card positioned via `transform` on its own node (never React state) to avoid 60 fps re-renders
- **Two-context architecture** — `useTodoActions()` (stable) + `useTodos()` (state); `TodoRow` is `React.memo`'d; grouping `useMemo` reuses parent objects; no background refetch after mutations (eliminated the "tick undoes itself" bug)
- **Sub-tasks** — one level only; `subtask_mode: independent | dependent`; API rejects a `parent_id` that itself has a parent
- **Recurrence** — one real row at a time; completing creates the next; `on_missed: skip` default
- **Rollover** — `POST /api/todos/rollover`; idempotent; called once daily by the page; defaults to **off** (overdue stays overdue, not silently carried forward)
- **PeriodView** — Week and Month are open-ended; bidirectional infinite scroll via IntersectionObserver; `BACKWARD_TRIGGER_PX` sentinel with no `rootMargin`; instant scroll correction on prepend (no animation) via layout effect; `scroll-behavior: smooth` removed from `globals.css` to prevent the correction from animating
- **"Anytime" tray** (not "Unassigned") — undated work that is real but not owed to a specific day
- **Focus mode** — 25-minute timer; progress bar and streak
- **Colour schemes** — 5 presets (Ruang Calm / Electric Indigo / Citrus / Emerald / Neon Dusk); stored in `users.color_scheme`; sending a scheme also nulls `accent_color` so the scheme's accent wins
- Sticky frosted-glass headers with scrollspy period title
- Carried-over (overdue) items pinned above all groups as an amber `OverdueGroup`, never red — "carried over" is a state of affairs, not an error
- Home today-strip; sidebar and tab-bar to-do entries
- **Checklist-note migration** — `POST /api/todos/migrate` converts `type = 'checklist'` notes; each `taskItem` becomes an unassigned to-do; note is preserved; `source_note_id` makes the route re-runnable
- One calendar at `/calendar` — the `/todo` calendar switch is now a link, not a view toggle; `CalendarScreen` wraps `TodoProvider` + `TodoDragProvider` so drops on calendar cells run the same code as drops in the list
- `files.widget_id` made nullable to support direct todo file attachments without requiring a widget row

**Schema:** `supabase_schema_phase7.sql` — `todos`, `todo_attachments`, indexes, RLS, `todo_*` preference columns; `supabase_schema_phase8.sql` — performance indexes for to-do query shapes; `supabase_schema_phase9.sql` — `users.color_scheme` column + CHECK; `supabase_schema_phase10.sql` — `files.widget_id` nullable

---

### v1.7 — Bug Fix Patch *(Aug 26, 2026)*

No new schema migrations. Fixes to auth, file uploads, sub-task rendering, and the forgotten-password flow.

**What shipped:**
- **Email signup edge case** — `POST /api/auth/register` now silently succeeds when `auth.users` already has an entry for the address (partial-signup recovery) instead of returning "Registration failed"
- **Google OAuth AccessDenied** — `signIn` callback queries `auth.users` via service-role before calling `createUser`; accounts where the auth row exists but `public.users` is missing are recovered without error
- **Forgot password — full HMAC-OTP flow:**
  - `POST /api/auth/forgot-password` — rate-limited 3 per 15 min per IP; stateless HMAC code via `lib/otp.ts`; always returns `{ ok: true }` (anti-enumeration)
  - `POST /api/auth/verify-otp` — 3 attempts / 30 s cooldown; accepts current + previous 10-min window (~20 min total); issues signed reset token
  - `POST /api/auth/reset-password` — verifies HMAC + 30-min expiry; updates password via `auth.admin.updateUserById`
  - Login page: 4-step UI (email → 6-char OTP → new password → confirmation)
- **Todo file attachment "Failed to fetch"** — browser-side presigned PUT was blocked by R2 CORS; replaced with server-side `multipart/form-data` upload via `putToR2()` in `lib/r2.ts`; `AttachPopover` POSTs one request, no client-side R2 call
- **Sub-task disappearance** — completed parent rows now always show their sub-tasks; `SubtaskRow` shows its own due date when different from the parent's; overdue open sub-tasks show a red "Overdue" notice
- **Settings → About tab** — version badge (v1.7), scrollable version history, stack credits

---

## What's Next (Phase 2 & 3)

**Phase 2 — Polish and Power** *(not yet built)*
- Automated reminder and to-do cron delivery (replace manual trigger)
- To-do file attachments in the UI (DB + API exist; upload path is note-editor only)
- Space sharing (invite by email, viewer/editor roles)
- Focus mode per-space
- Slash command picker inside TipTap
- Callout block type

**Phase 3 — Public Layer** *(not yet built)*
- Public Ruang page (`ruang.app/[username]`)
- Publish individual notes
- Threaded note replies
- Follow a user's Ruang page
- Custom domain for public page

---

## Design Principles

1. **Speed before structure.** Capture takes zero decisions.
2. **The desk metaphor.** Your Ruang reflects how you work.
3. **Calm, not cluttered.** UI surfaces only what's needed at that moment.
4. **ADHD-friendly without being patronizing.** No popups. No mandatory fields. No "are you sure?" dialogs.
5. **Expression is a feature.** Deep personalization without feeling like a settings page.

---

## Development

```bash
npm install
cp .env.example .env.local   # fill in your credentials
npm run dev
```

See `CLAUDE.md` for the full architecture reference, design tokens, data model, and critical rules.
