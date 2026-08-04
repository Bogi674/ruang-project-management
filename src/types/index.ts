export type EntryType = "note" | "file" | "task" | "reminder" | "link";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
export type UserRole = "admin" | "member" | "viewer";
export type ProjectMemberRole = "owner" | "editor" | "viewer";

export interface User {
  id: string;
  public_id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: UserRole;
  session_timeout_minutes: number;
  created_at: string;
}

export interface Project {
  id: string;
  public_id: string;
  name: string;
  description: string | null;
  color: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  member_role?: ProjectMemberRole;
}

export interface Workstream {
  id: string;
  public_id: string;
  project_id: string;
  name: string;
  description: string | null;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Entry {
  id: string;
  public_id: string;
  type: EntryType;
  project_id: string;
  workstream_id: string;
  created_by: string;
  pinned_date: string | null;
  pinned_date_end: string | null;
  tags: string[];
  content: NoteContent | FileContent | TaskContent | ReminderContent | LinkContent;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  // joined
  project?: Project;
  workstream?: Workstream;
  creator?: User;
  assignees?: User[];
  files?: FileRecord[];
}

export interface NoteContent {
  title: string;
  tiptap_json: object;
  is_locked: boolean;
  version_number: number;
}

export interface FileContent {
  title: string;
  description: string;
}

export interface TaskContent {
  title: string;
  status: TaskStatus;
  due_date: string | null;
}

export interface ReminderContent {
  title: string;
  type_label: "deadline" | "follow_up" | "meeting" | "review";
  schedule_type: "one_time" | "recurring";
  scheduled_at: string | null;
  recurrence: object | null;
  audience_type: "just_me" | "all_members" | "specific";
  recipient_ids: string[];
}

export interface LinkContent {
  url: string;
  title: string;
  og_image: string | null;
  og_description: string | null;
  notes: string;
}

export interface FileRecord {
  id: string;
  entry_id: string;
  project_id: string;
  uploaded_by: string;
  filename: string;
  size_bytes: number;
  mime_type: string;
  r2_object_key: string;
  r2_bucket: string;
  created_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectMemberRole;
  created_at: string;
  user?: User;
}

export interface Invitation {
  id: string;
  project_id: string;
  email: string;
  role: ProjectMemberRole;
  token: string;
  invited_by: string;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  entry_id: string | null;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
}
