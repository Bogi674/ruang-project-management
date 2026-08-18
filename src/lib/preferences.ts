'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  UserPreferences,
  defaultPreferences,
  resolveTheme,
  themeAttributes,
  browserThemeColor,
} from './theme';

export type { UserPreferences } from './theme';
export {
  ACCENT_PRESETS,
  APP_BACKGROUND_VALUES,
  BACKGROUND_TINT_VALUES,
} from './theme';

/**
 * Two caches, and they are not interchangeable.
 *
 * THEME_CACHE_KEY holds the *resolved* output — the `data-*` attributes and CSS
 * custom properties. The blocking script in the root layout replays it before
 * first paint, and it cannot import this module to resolve anything itself.
 *
 * PREFS_CACHE_KEY holds the raw preference values. React needs these: without
 * them a render that arrives with no server-side preferences (the login page, a
 * PWA cold start, a request where the session could not be read) falls back to
 * `defaultPreferences` and then repaints *light* over the dark theme the
 * pre-paint script had just restored — and overwrites the theme cache with it.
 * That is the loop that made dark mode look like it reverted on every launch.
 */
const THEME_CACHE_KEY = 'ruang_theme_cache';
const PREFS_CACHE_KEY = 'ruang_prefs';

const PREFERENCE_KEYS = Object.keys(defaultPreferences) as (keyof UserPreferences)[];

/**
 * Narrows an arbitrary object to the preference columns we recognise.
 *
 * Booleans and numbers are accepted as well as strings: the to-do settings
 * added in phase 7 are `boolean` and `int` columns, and a string-only filter
 * dropped them silently — the settings would apply, then read back as unset on
 * the next load with nothing to show for it.
 */
function pickPreferences(source: Record<string, unknown>): Partial<UserPreferences> {
  const out: Partial<UserPreferences> = {};
  for (const key of PREFERENCE_KEYS) {
    const value = source[key];
    const type = typeof value;
    if (value === null || type === 'string' || type === 'boolean' || type === 'number') {
      out[key] = value as never;
    }
  }
  return out;
}

function readCachedPreferences(): Partial<UserPreferences> | null {
  try {
    const raw = localStorage.getItem(PREFS_CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return pickPreferences(parsed as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * Writes the resolved theme onto <html>. The server does exactly the same
 * thing during SSR via resolveTheme + themeAttributes, so this only ever has
 * to handle *changes*, not the initial paint.
 */
export function applyPreferences(prefs: Partial<UserPreferences>) {
  const root = document.documentElement;
  const resolved = resolveTheme(prefs);

  for (const [key, value] of Object.entries(resolved.vars)) {
    root.style.setProperty(key, value);
  }

  const attrs = themeAttributes(resolved);
  for (const [key, value] of Object.entries(attrs)) {
    root.setAttribute(key, value);
  }
  // themeAttributes omits data-surface for "clean"; clear any stale value.
  if (!attrs['data-surface']) root.removeAttribute('data-surface');

  // Keep the mobile browser chrome in step with the palette.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', browserThemeColor(resolved));

  try {
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify({ attrs, vars: resolved.vars }));
    localStorage.setItem(PREFS_CACHE_KEY, JSON.stringify(pickPreferences(prefs as Record<string, unknown>)));
  } catch {
    /* private mode / quota — the server render still covers the common case */
  }
}

/**
 * A rejected save, described well enough for Settings to put the message next
 * to the control that failed.
 *
 * `fields` is what makes that possible. The banner used to sit at the top of
 * the Appearance tab while the App Background grid is ~600px further down, so
 * a rejected write looked like a selector that unselects itself for no reason.
 */
export interface PreferenceSaveError {
  message: string;
  /** The preference keys the rejected request carried. */
  fields: string[];
}

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
  /** Set when the last save was rejected, so settings can say so out loud. */
  saveError: PreferenceSaveError | null;
}

const PreferencesContext = createContext<PreferencesContextType>({
  preferences: defaultPreferences,
  updatePreferences: async () => {},
  saveError: null,
});

export function PreferencesProvider({
  children,
  initialPreferences,
}: {
  children: React.ReactNode;
  initialPreferences?: Partial<UserPreferences> | null;
}) {
  const hasServerPreferences = Boolean(initialPreferences);
  const [preferences, setPreferences] = useState<UserPreferences>({
    ...defaultPreferences,
    ...(initialPreferences || {}),
  });
  const [saveError, setSaveError] = useState<PreferenceSaveError | null>(null);

  // A ref shadows the state so the callback can be identity-stable while still
  // merging onto the newest value — settings are tapped in quick bursts and a
  // stale closure would drop whichever change landed second.
  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;

  const adopt = useCallback((next: Partial<UserPreferences>) => {
    const merged = { ...defaultPreferences, ...next };
    prefsRef.current = merged;
    setPreferences(merged);
    applyPreferences(merged);
  }, []);

  useEffect(() => {
    // The server already painted this exact state onto <html>; re-applying on
    // mount only refreshes the caches for the next cold start.
    if (hasServerPreferences) {
      applyPreferences(prefsRef.current);
      return;
    }

    /*
     * No server-side answer. The pre-paint script has already restored the
     * cached palette, so the one thing this must not do is repaint defaults
     * over it. Adopt the cached values, then ask the API for the real ones —
     * on /login that 401s and the cache stands, which is the intent.
     */
    const cached = readCachedPreferences();
    if (cached) adopt(cached);

    let cancelled = false;
    fetch('/api/users')
      .then((res) => (res.ok ? res.json() : null))
      .then((user: Record<string, unknown> | null) => {
        if (cancelled || !user) return;
        adopt(pickPreferences(user));
      })
      .catch(() => {
        /* Offline: the cached theme is the best answer available. */
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    const previous = prefsRef.current;
    const next = { ...previous, ...updates };
    prefsRef.current = next;
    setPreferences(next);
    applyPreferences(next);
    setSaveError(null);

    // Distinguishes "the server said no" from "the request never arrived".
    // Both roll back, but only one of them is fixed by checking your wifi.
    let rejection: string | null = null;

    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        rejection =
          body && typeof (body as { error?: unknown }).error === 'string'
            ? (body as { error: string }).error
            : `the server returned HTTP ${res.status}.`;
        throw new Error(rejection);
      }
    } catch {
      /*
       * Roll back rather than leave the screen showing something the database
       * never accepted. A setting that appears to apply and then quietly
       * reverts on the next load is the harder bug to diagnose of the two.
       * Skipped if a newer change has already landed on top of this one.
       */
      if (prefsRef.current === next) {
        prefsRef.current = previous;
        setPreferences(previous);
        applyPreferences(previous);
      }
      setSaveError({
        message: rejection
          ? `Couldn't save that setting — ${rejection}`
          : "Couldn't save that setting — check your connection and try again.",
        fields: Object.keys(updates),
      });
    }
  }, []);

  return React.createElement(
    PreferencesContext.Provider,
    { value: { preferences, updatePreferences, saveError } },
    children
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
