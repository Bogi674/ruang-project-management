'use client';

/**
 * Shared drag-and-drop payload for moving notes between spaces.
 *
 * A custom MIME type is used so that `dragover` handlers can tell a note drag
 * apart from an unrelated drag (file, text selection) — during `dragover` the
 * browser only exposes `dataTransfer.types`, never the data itself.
 */
export const NOTE_DND_MIME = 'application/x-ruang-note';

export interface NoteDragPayload {
  noteId: string;
  fromSpaceId: string | null;
}

export function setNoteDragData(e: React.DragEvent, payload: NoteDragPayload) {
  e.dataTransfer.setData(NOTE_DND_MIME, JSON.stringify(payload));
  // Plain key kept for the calendar, which reads `noteId` directly.
  e.dataTransfer.setData('noteId', payload.noteId);
  e.dataTransfer.effectAllowed = 'move';
}

export function isNoteDrag(e: React.DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(NOTE_DND_MIME);
}

export function getNoteDragData(e: React.DragEvent): NoteDragPayload | null {
  try {
    const raw = e.dataTransfer.getData(NOTE_DND_MIME);
    if (!raw) {
      const noteId = e.dataTransfer.getData('noteId');
      return noteId ? { noteId, fromSpaceId: null } : null;
    }
    return JSON.parse(raw) as NoteDragPayload;
  } catch {
    return null;
  }
}

/** Move a note into a space (or to My Storeroom when `spaceId` is null). */
export async function moveNoteToSpace(noteId: string, spaceId: string | null): Promise<boolean> {
  try {
    const res = await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ space_id: spaceId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Broadcast so sidebar counts and list views can refresh without a full reload. */
export const NOTES_CHANGED_EVENT = 'ruang:notes-changed';

export function emitNotesChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTES_CHANGED_EVENT));
  }
}

/**
 * The same idea for to-dos, so the sidebar's open count follows a completion
 * made on the To-do page without waiting for a navigation.
 *
 * Kept here beside the notes event rather than in the to-do components: the
 * sidebar listens for both, and a listener whose two events come from
 * different modules is one refactor away from only handling one of them.
 */
export const TODOS_CHANGED_EVENT = 'ruang:todos-changed';

export function emitTodosChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TODOS_CHANGED_EVENT));
  }
}
