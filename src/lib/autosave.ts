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

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;

export function scheduleSync(
  noteId: string,
  content: object,
  setState: SetState,
  delay = 1500
): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  saveDraft(noteId, content);

  debounceTimer = setTimeout(() => {
    syncToServer(noteId, content, setState);
  }, delay);
}

async function syncToServer(noteId: string, content: object, setState: SetState): Promise<void> {
  setState({ status: 'saving', lastSaved: null });
  try {
    const res = await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) throw new Error('Sync failed');
    clearDraft(noteId);
    retryCount = 0;
    setState({ status: 'saved', lastSaved: new Date() });
    setTimeout(() => setState({ status: 'idle', lastSaved: null }), 2000);
  } catch {
    if (retryCount < 3) {
      retryCount++;
      const backoff = Math.pow(2, retryCount) * 1000;
      setTimeout(() => syncToServer(noteId, content, setState), backoff);
    } else {
      retryCount = 0;
      setState({ status: 'error', lastSaved: null });
    }
  }
}
