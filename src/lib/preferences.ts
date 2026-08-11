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
 * Mirrors the resolved theme into localStorage so a logged-out or
 * pre-hydration render (login page, PWA cold start) can paint the right
 * palette before the session is known. The root layout reads this in a tiny
 * blocking script; the server value always wins when there is one.
 */
const THEME_CACHE_KEY = 'ruang_theme_cache';

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
    localStorage.setItem(
      THEME_CACHE_KEY,
      JSON.stringify({ attrs, vars: resolved.vars })
    );
  } catch {
    /* private mode / quota — the server render still covers the common case */
  }
}

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
}

const PreferencesContext = createContext<PreferencesContextType>({
  preferences: defaultPreferences,
  updatePreferences: async () => {},
});

export function PreferencesProvider({
  children,
  initialPreferences,
}: {
  children: React.ReactNode;
  initialPreferences?: Partial<UserPreferences> | null;
}) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    ...defaultPreferences,
    ...(initialPreferences || {}),
  });

  // The server already painted this exact state onto <html>; re-applying on
  // mount only refreshes the localStorage cache for the next cold start.
  useEffect(() => {
    applyPreferences(preferences);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A ref shadows the state so the callback can be identity-stable while still
  // merging onto the newest value — settings are tapped in quick bursts and a
  // stale closure would drop whichever change landed second.
  const prefsRef = useRef(preferences);
  prefsRef.current = preferences;

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    const next = { ...prefsRef.current, ...updates };
    prefsRef.current = next;
    setPreferences(next);
    applyPreferences(next);

    try {
      await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
    } catch {
      /* The local state stands; the next successful save reconciles it. */
    }
  }, []);

  return React.createElement(
    PreferencesContext.Provider,
    { value: { preferences, updatePreferences } },
    children
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
