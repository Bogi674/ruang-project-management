/**
 * Theme resolution — shared by the server (root layout) and the client
 * (PreferencesProvider).
 *
 * This module is deliberately framework-free and side-effect-free: the root
 * layout renders the resulting attributes and custom properties straight onto
 * `<html>` during SSR, which is what makes the theme survive a reload without
 * a flash of the light palette. `lib/preferences.ts` applies the exact same
 * output to `document.documentElement` when a setting changes at runtime.
 *
 * Everything colour-related derives from these tokens. Tailwind's palette in
 * `tailwind.config.ts` is mapped onto the same custom properties, so a utility
 * class like `bg-bg-base` follows the theme automatically. Do not introduce
 * hard-coded hex values in components.
 */

export interface UserPreferences {
  accent_color: string | null;
  typography_preference: string | null;
  surface_preference: string | null;
  density_preference: string | null;
  landing_page_preference: string | null;
  theme_preference: string | null;
  app_background_preference: string | null;
  background_tint_preference: string | null;
}

export const defaultPreferences: UserPreferences = {
  accent_color: null,
  typography_preference: null,
  surface_preference: null,
  density_preference: null,
  landing_page_preference: null,
  theme_preference: null,
  app_background_preference: null,
  background_tint_preference: null,
};

export const ACCENT_PRESETS = [
  { label: 'Soft Blue', value: '#A1B5D8' },
  { label: 'Sage', value: '#7eb87e' },
  { label: 'Sand', value: '#d4a574' },
  { label: 'Rose', value: '#d4879a' },
  { label: 'Plum', value: '#9b7ec8' },
  { label: 'Slate', value: '#738290' },
];

export const THEME_VALUES = ['light', 'dark'] as const;
export const TYPOGRAPHY_VALUES = ['sans', 'serif'] as const;
export const DENSITY_VALUES = ['compact', 'comfortable', 'spacious'] as const;
export const SURFACE_VALUES = ['clean', 'dotgrid', 'warm', 'lined'] as const;
export const LANDING_VALUES = ['home', 'room', 'storeroom'] as const;
export const APP_BACKGROUND_VALUES = ['plain', 'dots', 'grid', 'diagonal', 'waves', 'glow'] as const;
export const BACKGROUND_TINT_VALUES = ['neutral', 'warm', 'cool', 'mint', 'blush', 'accent'] as const;

export type ThemeValue = (typeof THEME_VALUES)[number];
export type AppBackgroundValue = (typeof APP_BACKGROUND_VALUES)[number];
export type BackgroundTintValue = (typeof BACKGROUND_TINT_VALUES)[number];

/** Accepted values per preference column, used by the API to reject junk. */
export const PREFERENCE_ENUMS: Record<string, readonly string[]> = {
  theme_preference: THEME_VALUES,
  typography_preference: TYPOGRAPHY_VALUES,
  density_preference: DENSITY_VALUES,
  surface_preference: SURFACE_VALUES,
  landing_page_preference: LANDING_VALUES,
  app_background_preference: APP_BACKGROUND_VALUES,
  background_tint_preference: BACKGROUND_TINT_VALUES,
};

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/* ── colour maths ───────────────────────────────────────────────────────── */

function hexToRgb(hex: string) {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

function toHex(r: number, g: number, b: number) {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear blend: `amount` 0 returns `from`, 1 returns `to`. */
function mix(from: string, to: string, amount: number): string {
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  return toHex(
    a.r + (b.r - a.r) * amount,
    a.g + (b.g - a.g) * amount,
    a.b + (b.b - a.b) * amount
  );
}

/** Perceived brightness, 0–255. Used to pick readable foregrounds. */
function luminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Black or white, whichever reads better on `hex`. */
export function contrastInk(hex: string): string {
  return luminance(hex) > 168 ? '#1b2230' : '#ffffff';
}

/* ── palettes ───────────────────────────────────────────────────────────── */

const LIGHT_BASE = '#ffffff';
const DARK_BASE = '#1c2130';

/**
 * Page canvas colours. The canvas is the surface *behind* cards — sidebar,
 * dashboard backdrop, calendar gutters — so it is always a shade away from
 * `--bg-base`, never equal to it.
 */
const TINTS: Record<BackgroundTintValue, { light: string; dark: string }> = {
  neutral: { light: '#f4f7fb', dark: '#12161f' },
  warm: { light: '#faf6ef', dark: '#1a1611' },
  cool: { light: '#eff5fc', dark: '#101720' },
  mint: { light: '#f0f7f2', dark: '#101a15' },
  blush: { light: '#fbf3f5', dark: '#1b1418' },
  // `accent` is derived from the user's accent colour at resolve time.
  accent: { light: '#f4f7fb', dark: '#12161f' },
};

/**
 * Hand-picked light-mode pairs that override the derivation.
 *
 * Soft Blue's chip fill and ink are locked design tokens (see CLAUDE.md), and
 * a flat multiply cannot reproduce them — it desaturates toward grey. Deriving
 * them would have quietly restyled the default theme for every existing user,
 * so the locked pair is used verbatim and the formula only handles the accents
 * that never had designed values.
 */
const LOCKED_LIGHT_ACCENT: Record<string, { ink: string; bg: string }> = {
  '#A1B5D8': { ink: '#4a6090', bg: '#dce8f6' },
};

function normalize<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T
): T {
  return (allowed as readonly string[]).includes(value ?? '') ? (value as T) : fallback;
}

export interface ResolvedTheme {
  theme: ThemeValue;
  typography: (typeof TYPOGRAPHY_VALUES)[number];
  density: (typeof DENSITY_VALUES)[number];
  surface: (typeof SURFACE_VALUES)[number];
  landing: (typeof LANDING_VALUES)[number];
  appBackground: AppBackgroundValue;
  tint: BackgroundTintValue;
  accent: string;
  /** CSS custom properties to set on `<html>`. */
  vars: Record<string, string>;
}

export function resolveTheme(prefs: Partial<UserPreferences> | null | undefined): ResolvedTheme {
  const p = prefs ?? {};

  // Dark is opt-in only — never inherited from the OS. An explicit choice is
  // the only thing that flips the palette.
  const theme = normalize(p.theme_preference, THEME_VALUES, 'light');
  const typography = normalize(p.typography_preference, TYPOGRAPHY_VALUES, 'sans');
  const density = normalize(p.density_preference, DENSITY_VALUES, 'comfortable');
  const surface = normalize(p.surface_preference, SURFACE_VALUES, 'clean');
  const landing = normalize(p.landing_page_preference, LANDING_VALUES, 'home');
  const appBackground = normalize(p.app_background_preference, APP_BACKGROUND_VALUES, 'plain');
  const tint = normalize(p.background_tint_preference, BACKGROUND_TINT_VALUES, 'neutral');

  const accent =
    p.accent_color && HEX_COLOR.test(p.accent_color) ? p.accent_color : ACCENT_PRESETS[0].value;

  const isDark = theme === 'dark';

  /*
   * Accent derivatives.
   *
   * `--accent-blue-bg` is the soft chip/well fill and `--accent-blue-dark` is
   * the text drawn on it. In light mode the fill is a wash toward white and
   * the ink is a darkened accent; in dark mode both invert — a fill mixed
   * toward the dark base with a lightened accent on top. Computing them per
   * theme is what stops accent chips from staying pale blue on a dark page.
   */
  const locked = !isDark ? LOCKED_LIGHT_ACCENT[accent.toUpperCase()] : undefined;
  const accentBg = locked?.bg ?? (isDark ? mix(accent, DARK_BASE, 0.76) : mix(accent, LIGHT_BASE, 0.82));
  const accentInk = locked?.ink ?? (isDark ? mix(accent, '#ffffff', 0.42) : mix(accent, '#000000', 0.4));

  const canvas =
    tint === 'accent'
      ? isDark
        ? mix(accent, '#0d1017', 0.9)
        : mix(accent, '#ffffff', 0.9)
      : TINTS[tint][isDark ? 'dark' : 'light'];

  const vars: Record<string, string> = {
    '--accent-blue': accent,
    '--accent-blue-dark': accentInk,
    '--accent-blue-bg': accentBg,
    '--accent-ink': contrastInk(accent),
    '--bg-page': canvas,
    '--canvas-base': canvas,
    // Pattern ink for the app background graphics: dark strokes on light
    // canvases, light strokes on dark ones.
    '--canvas-ink': isDark ? 'rgba(255,255,255,0.055)' : 'rgba(44,56,72,0.055)',
    '--canvas-glow': isDark ? mix(accent, DARK_BASE, 0.62) : mix(accent, LIGHT_BASE, 0.72),
    '--font-body':
      typography === 'serif'
        ? "'Newsreader', Georgia, serif"
        : "system-ui, -apple-system, 'Segoe UI', sans-serif",
    // Shadows read as a soft lift on white and as depth on dark.
    '--shadow-fab': `0 4px 16px ${isDark ? 'rgba(0,0,0,.5)' : 'rgba(44,56,72,.18)'}`,
    '--shadow-fab-hover': `0 8px 28px ${isDark ? 'rgba(0,0,0,.6)' : 'rgba(44,56,72,.24)'}`,
  };

  // Native form controls, scrollbars and autofill follow `color-scheme`,
  // which is set from `[data-theme]` in globals.css rather than here — it is
  // a real CSS property, not a custom one, so it cannot ride in this map.

  return { theme, typography, density, surface, landing, appBackground, tint, accent, vars };
}

/** `data-*` attributes that drive the CSS rules in globals.css. */
export function themeAttributes(resolved: ResolvedTheme): Record<string, string> {
  const attrs: Record<string, string> = {
    'data-theme': resolved.theme,
    'data-density': resolved.density,
    'data-app-bg': resolved.appBackground,
    'data-tint': resolved.tint,
  };
  // "clean" is the absence of any surface rule, so no attribute is emitted.
  if (resolved.surface !== 'clean') attrs['data-surface'] = resolved.surface;
  return attrs;
}

/** The theme-colour meta value, so the mobile browser chrome matches. */
export function browserThemeColor(resolved: ResolvedTheme): string {
  return resolved.theme === 'dark' ? '#12161f' : '#ffffff';
}
