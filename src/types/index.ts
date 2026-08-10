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
