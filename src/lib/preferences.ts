'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface UserPreferences {
  accent_color: string | null;
  typography_preference: string | null;
  surface_preference: string | null;
  density_preference: string | null;
  landing_page_preference: string | null;
  theme_preference: string | null;
}

export const ACCENT_PRESETS = [
  { label: 'Soft Blue', value: '#A1B5D8' },
  { label: 'Sage', value: '#7eb87e' },
  { label: 'Sand', value: '#d4a574' },
  { label: 'Rose', value: '#d4879a' },
  { label: 'Plum', value: '#9b7ec8' },
  { label: 'Slate', value: '#738290' },
];

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

function darken(hex: string, factor = 0.6): string {
  const { r, g, b } = hexToRgb(hex);
  return `#${Math.round(r * factor).toString(16).padStart(2, '0')}${Math.round(g * factor).toString(16).padStart(2, '0')}${Math.round(b * factor).toString(16).padStart(2, '0')}`;
}

function lightBg(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.round(r * 0.18 + 255 * 0.82);
  const lg = Math.round(g * 0.18 + 255 * 0.82);
  const lb = Math.round(b * 0.18 + 255 * 0.82);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

export function applyPreferences(prefs: Partial<UserPreferences>) {
  const root = document.documentElement;

  if (prefs.accent_color) {
    const hex = prefs.accent_color;
    root.style.setProperty('--accent-blue', hex);
    root.style.setProperty('--accent-blue-dark', darken(hex, 0.6));
    root.style.setProperty('--accent-blue-bg', lightBg(hex));
  }

  const resolveTheme = (pref: string | null) => {
    if (pref === 'dark') return 'dark';
    if (pref === 'light') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  root.setAttribute('data-theme', resolveTheme(prefs.theme_preference ?? null));

  const density = prefs.density_preference || 'comfortable';
  root.setAttribute('data-density', density);

  const typography = prefs.typography_preference || 'sans';
  if (typography === 'serif') {
    root.style.setProperty('--font-body', "'Newsreader', Georgia, serif");
  } else {
    root.style.setProperty('--font-body', "system-ui, -apple-system, 'Segoe UI', sans-serif");
  }
}

interface PreferencesContextType {
  preferences: UserPreferences;
  updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
}

const defaultPrefs: UserPreferences = {
  accent_color: null,
  typography_preference: null,
  surface_preference: null,
  density_preference: null,
  landing_page_preference: null,
  theme_preference: null,
};

const PreferencesContext = createContext<PreferencesContextType>({
  preferences: defaultPrefs,
  updatePreferences: async () => {},
});

export function PreferencesProvider({
  children,
  initialPreferences,
}: {
  children: React.ReactNode;
  initialPreferences?: Partial<UserPreferences>;
}) {
  const [preferences, setPreferences] = useState<UserPreferences>({
    ...defaultPrefs,
    ...initialPreferences,
  });

  useEffect(() => {
    applyPreferences(preferences);
  }, []);

  const updatePreferences = useCallback(async (updates: Partial<UserPreferences>) => {
    const next = { ...preferences, ...updates };
    setPreferences(next);
    applyPreferences(next);
    await fetch('/api/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }, [preferences]);

  return React.createElement(
    PreferencesContext.Provider,
    { value: { preferences, updatePreferences } },
    children
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
