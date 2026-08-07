'use client';

import { useState, useEffect, useCallback } from 'react';
import { Space } from '@/types';

/**
 * Shared client-side store for the space tree.
 *
 * The sidebar, the mobile drawer, every note list and the note editor all need
 * the same tree. Before this, each of them fired its own `GET /api/spaces` on
 * mount — four or more identical round-trips per navigation. This module keeps
 * one in-memory copy, de-duplicates concurrent fetches, and warm-starts from
 * sessionStorage so the first paint after a reload already has the tree.
 */

const CACHE_KEY = 'ruang_spaces_cache';

let cache: Space[] | null = null;
let inflight: Promise<Space[]> | null = null;
const subscribers = new Set<(spaces: Space[]) => void>();

function readSessionCache(): Space[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function publish(spaces: Space[]) {
  cache = spaces;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(spaces));
  } catch {
    /* private mode / quota — the in-memory copy still works */
  }
  subscribers.forEach((fn) => fn(spaces));
}

/** Fetch the tree, reusing the in-flight request when one is already open. */
export function fetchSpaces(force = false): Promise<Space[]> {
  if (!force && cache) return Promise.resolve(cache);
  if (inflight) return inflight;

  inflight = fetch('/api/spaces')
    .then((r) => r.json())
    .then((d) => {
      const list: Space[] = Array.isArray(d) ? d : [];
      publish(list);
      return list;
    })
    .catch(() => cache || [])
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Drop the cache and refetch — call after creating, editing or deleting a space. */
export function invalidateSpaces(): Promise<Space[]> {
  cache = null;
  return fetchSpaces(true);
}

/**
 * Subscribe to the shared tree. Returns the current list plus a `refresh`
 * that forces a round-trip and notifies every other subscriber.
 */
export function useSpaces(): { spaces: Space[]; refresh: () => Promise<Space[]> } {
  const [spaces, setSpaces] = useState<Space[]>(() => cache || []);

  useEffect(() => {
    if (!cache) {
      const stored = readSessionCache();
      if (stored) {
        cache = stored;
        setSpaces(stored);
      }
    } else {
      setSpaces(cache);
    }

    subscribers.add(setSpaces);
    // Always revalidate in the background; a stale warm start is fine.
    fetchSpaces(true);
    return () => {
      subscribers.delete(setSpaces);
    };
  }, []);

  const refresh = useCallback(() => invalidateSpaces(), []);

  return { spaces, refresh };
}
