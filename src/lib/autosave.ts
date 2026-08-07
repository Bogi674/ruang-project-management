'use client';

import { AutosaveState } from '@/types';

const DRAFT_PREFIX = 'ruang_draft_';

export function saveDraft(noteId: string, content: object): void {
  try {
    localStorage.setItem(`${DRAFT_PREFIX}${noteId}`, JSON.stringify(content));
  } catch {}
}

export function loadDraft(noteId: string): object | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${noteId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(noteId: string): void {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${noteId}`);
  } catch {}
}

type SetState = (state: AutosaveState) => void;

const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const retryCounts: Record<string, number> = {};

export function scheduleSync(
  noteId: string,
  content: object,
  setState: SetState,
  title?: string,
  delay = 1500
): void {
  if (debounceTimers[noteId]) clearTimeout(debounceTimers[noteId]);
  saveDraft(noteId, content);

  debounceTimers[noteId] = setTimeout(() => {
    syncToServer(noteId, content, setState, title);
  }, delay);
}

async function syncToServer(
  noteId: string,
  content: object,
  setState: SetState,
  title?: string
): Promise<void> {
  setState({ status: 'saving', lastSaved: null });
  try {
    const body: Record<string, unknown> = { content };
    if (title !== undefined) body.title = title;
    const res = await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Sync failed');
    clearDraft(noteId);
    retryCounts[noteId] = 0;
    setState({ status: 'saved', lastSaved: new Date() });
    setTimeout(() => setState({ status: 'idle', lastSaved: null }), 2000);
  } catch {
    const count = (retryCounts[noteId] || 0) + 1;
    retryCounts[noteId] = count;
    if (count < 3) {
      const backoff = Math.pow(2, count) * 1000;
      setTimeout(() => syncToServer(noteId, content, setState, title), backoff);
    } else {
      retryCounts[noteId] = 0;
      setState({ status: 'error', lastSaved: null });
    }
  }
}
