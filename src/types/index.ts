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

export interface ReminderContent {
  title: string;
  date: string | null;
  time: string | null;
  recurrence: RecurrenceType;
  type_label: ReminderLabel;
}

export interface FileContent {
  description: string;
}

export interface LinkContent {
  url: string;
  og_title: string;
  og_description: string;
  og_image: string | null;
  note: string;
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
