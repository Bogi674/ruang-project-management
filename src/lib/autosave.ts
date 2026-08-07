'use client';

import { AutosaveState } from '@/types';

const DRAFT_PREFIX = 'ruang_draft_';

interface Draft {
  content: object | null;
  title?: string;
}

export function saveDraft(noteId: string, content: object | null, title?: string): void {
  try {
    localStorage.setItem(`${DRAFT_PREFIX}${noteId}`, JSON.stringify({ content, title } satisfies Draft));
  } catch {}
}

/** Returns the cached content only (back-compat with the old raw-content shape). */
export function loadDraft(noteId: string): object | null {
  const draft = loadDraftFull(noteId);
  return draft?.content ?? null;
}

export function loadDraftFull(noteId: string): Draft | null {
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${noteId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Older drafts stored the TipTap doc directly rather than {content,title}.
    if (parsed && typeof parsed === 'object' && 'content' in parsed && !('type' in parsed)) {
      return parsed as Draft;
    }
    return { content: parsed as object };
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

interface Pending {
  content: object | null;
  title?: string;
  setState: SetState;
}

const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const retryCounts: Record<string, number> = {};
/** Latest un-synced edit per note. Cleared only once the server confirms it. */
const pending: Record<string, Pending> = {};

/**
 * Queue a sync. Every call writes straight to localStorage first, so nothing is
 * ever lost between keystrokes; the network write is debounced behind it.
 */
export function scheduleSync(
  noteId: string,
  content: object | null,
  setState: SetState,
  title?: string,
  delay = 1200
): void {
  pending[noteId] = { content, title, setState };
  saveDraft(noteId, content, title);

  if (debounceTimers[noteId]) clearTimeout(debounceTimers[noteId]);
  debounceTimers[noteId] = setTimeout(() => { flushNote(noteId); }, delay);
}

/** Force the queued edit for one note to the server right now. */
export function flushNote(noteId: string): void {
  const item = pending[noteId];
  if (!item) return;
  if (debounceTimers[noteId]) {
    clearTimeout(debounceTimers[noteId]);
    delete debounceTimers[noteId];
  }
  syncToServer(noteId, item.content, item.setState, item.title);
}

/** Flush every queued edit — used on unmount, tab hide and page unload. */
export function flushAll(): void {
  Object.keys(pending).forEach(flushNote);
}

/**
 * Drop everything queued for a note without sending it. Used when the note is
 * deleted, so a pending autosave cannot recreate rows for it afterwards.
 */
export function cancelSync(noteId: string): void {
  if (debounceTimers[noteId]) {
    clearTimeout(debounceTimers[noteId]);
    delete debounceTimers[noteId];
  }
  delete pending[noteId];
  delete retryCounts[noteId];
  clearDraft(noteId);
}

function buildBody(content: object | null, title?: string) {
  const body: Record<string, unknown> = {};
  if (content !== null) body.content = content;
  if (title !== undefined) body.title = title;
  return body;
}

/**
 * Best-effort save that survives the page going away. `sendBeacon` is queued by
 * the browser and delivered even after the document is discarded; a keepalive
 * fetch is the fallback where beacon is unavailable.
 */
export function flushAllSync(): void {
  for (const [noteId, item] of Object.entries(pending)) {
    const body = buildBody(item.content, item.title);
    if (Object.keys(body).length === 0) continue;
    const url = `/api/notes/${noteId}`;
    const payload = JSON.stringify(body);
    try {
      // The API only accepts PATCH, and sendBeacon always POSTs — so use a
      // keepalive fetch, which is honoured during pagehide in every browser
      // that supports it.
      fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    } catch {}
  }
}

async function syncToServer(
  noteId: string,
  content: object | null,
  setState: SetState,
  title?: string
): Promise<void> {
  const body = buildBody(content, title);
  if (Object.keys(body).length === 0) return;

  setState({ status: 'saving', lastSaved: null });
  try {
    const res = await fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (!res.ok) throw new Error('Sync failed');

    // Only drop the local copy if no newer edit arrived while in flight.
    const latest = pending[noteId];
    const isStale = latest && (latest.content !== content || latest.title !== title);
    if (!isStale) {
      delete pending[noteId];
      clearDraft(noteId);
    }

    retryCounts[noteId] = 0;
    setState({ status: 'saved', lastSaved: new Date() });
    setTimeout(() => setState({ status: 'idle', lastSaved: null }), 2000);
  } catch {
    const count = (retryCounts[noteId] || 0) + 1;
    retryCounts[noteId] = count;
    if (count < 5) {
      const backoff = Math.min(Math.pow(2, count) * 1000, 15000);
      setTimeout(() => {
        const item = pending[noteId];
        if (item) syncToServer(noteId, item.content, item.setState, item.title);
      }, backoff);
      setState({ status: 'saving', lastSaved: null });
    } else {
      retryCounts[noteId] = 0;
      // The draft stays in localStorage so the text is recovered on reload.
      setState({ status: 'error', lastSaved: null });
    }
  }
}

/**
 * Install global flush hooks once per page. Returns a teardown function.
 * Covers: tab hidden / app backgrounded (mobile), bfcache unload, and reload.
 */
export function installFlushHooks(): () => void {
  function onVisibility() {
    if (document.visibilityState === 'hidden') flushAllSync();
  }
  function onPageHide() { flushAllSync(); }
  function onBeforeUnload() { flushAllSync(); }

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('beforeunload', onBeforeUnload);

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('beforeunload', onBeforeUnload);
  };
}
