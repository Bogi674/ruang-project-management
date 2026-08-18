export type NoteType = 'note' | 'checklist';
export type WidgetType = 'reminder' | 'file' | 'link';
export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly';
export type ReminderLabel = 'Deadline' | 'Follow-up' | 'Meeting' | 'Review';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  accent_color: string | null;
  typography_preference: string | null;
  surface_preference: string | null;
  density_preference: string | null;
  landing_page_preference: string | null;
  theme_preference: string | null;
  app_background_preference: string | null;
  background_tint_preference: string | null;
  created_at: string;
}

export interface Space {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  owner_id: string;
  parent_id: string | null;
  path: string;
  depth: number;
  is_shared: boolean;
  created_at: string;
  children?: Space[];
  /** Notes directly inside this space; set by GET /api/spaces. */
  note_count?: number;
}

export interface Note {
  id: string;
  user_id: string;
  type: NoteType;
  title: string | null;
  content: object | null;
  space_id: string | null;
  tags: string[];
  pinned_date: string | null;
  pinned_date_end: string | null;
  is_pinned_to_home: boolean;
  is_locked: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  space?: Space | null;
  widgets?: Widget[];
}

export interface NoteVersion {
  id: string;
  note_id: string;
  user_id: string;
  content: object;
  title: string | null;
  created_at: string;
}

/** How far ahead of `date`/`time` a reminder email goes out. */
export type ReminderLead = '15m' | '30m' | '1h' | '3h' | '1d' | '3d' | '1w';

export const REMINDER_LEAD_OPTIONS: { value: ReminderLead; label: string }[] = [
  { value: '15m', label: '15 min before' },
  { value: '30m', label: '30 min before' },
  { value: '1h', label: '1 hour before' },
  { value: '3h', label: '3 hours before' },
  { value: '1d', label: '1 day before' },
  { value: '3d', label: '3 days before' },
  { value: '1w', label: '1 week before' },
];

export interface ReminderContent {
  title: string;
  description?: string;
  date: string | null;
  time: string | null;
  recurrence: RecurrenceType;
  type_label: ReminderLabel;
  /** Email delivery — stored now, delivered by the Phase 2 Resend worker. */
  recipients?: string[];
  send_times?: number;
  send_early?: ReminderLead;
}

export interface FileContent {
  /** User-facing label; falls back to the uploaded filename when empty. */
  display_name?: string;
  description: string;
}

export interface LinkContent {
  url: string;
  og_title: string;
  og_description: string;
  og_image: string | null;
  domain?: string;
  note: string;
}

/**
 * A file already uploaded to R2 but not yet linked to a widget row — the
 * widget does not exist until the form is submitted, so the metadata is
 * carried in memory and written to `files` right after the widget insert.
 */
export interface PendingFileUpload {
  filename: string;
  r2_object_key: string;
  mime_type: string;
  size_bytes: number;
}

export interface LinkPreview {
  domain: string;
  og_title: string;
  og_description: string;
  og_image: string | null;
}

export interface Widget {
  id: string;
  user_id: string;
  note_id: string | null;
  type: WidgetType;
  content: ReminderContent | FileContent | LinkContent;
  created_at: string;
  file?: FileRecord | null;
}

export interface FileRecord {
  id: string;
  widget_id: string;
  uploaded_by: string;
  filename: string;
  r2_object_key: string;
  r2_bucket: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

/* ── To-dos (phase 7) ─────────────────────────────────────────────────────── */

/** Which slice of time the list is showing. Persisted per user. */
export type TodoFilter = 'today' | 'week' | 'month' | 'all';
export type TodoView = 'list' | 'calendar';

/** Whether a parent's own checkbox is gated by its sub-tasks. */
export type SubtaskMode = 'independent' | 'dependent';

/** Where a brand-new to-do lands when the user names no date. */
export type TodoAssignment = 'today' | 'unassigned';

/** `stay` dims and strikes in place; `section` moves the row to Done. */
export type TodoDoneBehavior = 'stay' | 'section';

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'custom';

/**
 * What happens to an instance the user never ticked before the next one was
 * due. `skip` is the default on purpose: rolling every missed repeat forward
 * is what turns a daily habit into a wall of overdue.
 */
export type RecurrenceOnMissed = 'skip' | 'rollover';

export interface RecurrenceEnds {
  type: 'never' | 'on' | 'after';
  /** ISO date, set when `type` is 'on'. */
  date?: string | null;
  /** Occurrence count, set when `type` is 'after'. */
  count?: number | null;
}

export interface TodoRecurrence {
  freq: RecurrenceFreq;
  /** Every N periods. 1 = every day / week / month. */
  interval: number;
  /** Weekday numbers, 0 = Sunday. Only meaningful for `weekly`. */
  byday?: number[];
  ends?: RecurrenceEnds;
  on_missed: RecurrenceOnMissed;
}

export interface TodoReminder {
  /** Reuses the widget reminder's lead vocabulary. */
  lead: ReminderLead;
  /** How many times to nudge. null = until the to-do is done. */
  repeat_count: number | null;
}

export interface TodoAttachment {
  id: string;
  todo_id: string;
  user_id: string;
  kind: 'file' | 'note';
  file_id: string | null;
  note_id: string | null;
  created_at: string;
  /** Hydrated by GET /api/todos so a row can render without a second fetch. */
  file?: FileRecord | null;
  note?: Pick<Note, 'id' | 'title' | 'updated_at'> | null;
}

export interface Todo {
  id: string;
  user_id: string;
  /** Non-null makes this a sub-task. Only ever one level deep. */
  parent_id: string | null;
  space_id: string | null;
  title: string;
  description: string | null;
  /** Date and time are independent — either may be null on its own. */
  due_date: string | null;
  due_time: string | null;
  estimate_minutes: number | null;
  /** Fractional, so a drop between two rows is one UPDATE. */
  position: number;
  is_completed: boolean;
  completed_at: string | null;
  subtask_mode: SubtaskMode;
  recurrence: TodoRecurrence | null;
  recurrence_parent_id: string | null;
  reminder: TodoReminder | null;
  source_note_id: string | null;
  created_at: string;
  updated_at: string;
  space?: Space | null;
  /** Nested on parents by GET /api/todos; never populated on a sub-task. */
  subtasks?: Todo[];
  attachments?: TodoAttachment[];
}

/**
 * The shape GET /api/todos returns. Overdue is its own bucket rather than a
 * date group because it is pinned to the top under every filter, and
 * `unassigned` is separate so undated work never sinks below a long stack of
 * dated days.
 */
export interface TodoGroups {
  overdue: Todo[];
  /** Keyed by ISO date (yyyy-MM-dd), ascending. Open items only. */
  dated: Record<string, Todo[]>;
  unassigned: Todo[];
  /** Completed items, keyed by the ISO date they belonged to ('' = undated). */
  done: Record<string, Todo[]>;
  counts: {
    tomorrow: number;
    restOfWeek: number;
    total: number;
    doneThisMonth: number;
  };
}

/** To-do settings. Stored on `users`; null means "not chosen, use the default". */
export interface TodoPreferences {
  todo_default_assignment: TodoAssignment | null;
  todo_done_behavior: TodoDoneBehavior | null;
  todo_subtask_mode: SubtaskMode | null;
  todo_show_estimates: boolean | null;
  todo_show_progress: boolean | null;
  /** Max open to-dos Today shows before folding the rest away. null = no cap. */
  todo_today_cap: number | null;
  todo_rollover: boolean | null;
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AutosaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
}

export interface CreateNotePayload {
  type?: NoteType;
  space_id?: string | null;
  initialWidgetType?: WidgetType;
}
