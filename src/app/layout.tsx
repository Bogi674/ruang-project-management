import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import {
  UserPreferences,
  resolveTheme,
  themeAttributes,
  browserThemeColor,
} from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Ruang',
  description: 'Your personal note space',
  manifest: '/manifest.json',
  // White-canvas icon set: dark mark on a rounded white square. Used for the
  // browser tab, the PWA/desktop install and the iOS home screen alike.
  icons: {
    icon: [
      { url: '/logo/ruang-icon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo/ruang-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo/ruang-icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/logo/ruang-icon-32.png',
    apple: '/logo/ruang-icon-192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Ruang',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Stops iOS Safari from auto-zooming when a field is focused, which made the
  // note editor jump in and out of zoom while typing.
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

/**
 * The columns are requested in two tiers on purpose.
 *
 * PostgREST fails a `select` **as a whole** when any one column in it does not
 * exist. So on a database where `supabase_schema_phase3.sql` has not been run
 * yet, asking for `app_background_preference` does not just lose the app
 * background — it loses `theme_preference` with it, the server renders the
 * light default, and the user's dark mode silently reverts on every load. The
 * core tier has shipped since the first schema file, so falling back to it
 * keeps theme, accent and typography working while the newer columns are
 * missing.
 */
const CORE_PREFERENCE_COLUMNS =
  'accent_color, typography_preference, surface_preference, density_preference, landing_page_preference, theme_preference';
const PREFERENCE_COLUMNS = `${CORE_PREFERENCE_COLUMNS}, app_background_preference, background_tint_preference`;

/**
 * Loads the signed-in user's appearance settings.
 *
 * Returning null (rather than defaults) is meaningful: it tells the render
 * below that no server-side choice exists, which is the signal for the
 * pre-paint script to fall back to the locally cached theme instead.
 */
async function loadPreferences(): Promise<Partial<UserPreferences> | null> {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) return null;

    const db = createServerClient();
    const { data, error } = await db
      .from('users')
      .select(PREFERENCE_COLUMNS)
      .eq('id', userId)
      .single();

    if (!error) return (data as Partial<UserPreferences>) ?? null;

    console.error('[layout:preferences] full select failed, retrying core columns:', error.message);

    const { data: core, error: coreError } = await db
      .from('users')
      .select(CORE_PREFERENCE_COLUMNS)
      .eq('id', userId)
      .single();

    if (coreError) {
      console.error('[layout:preferences] core select failed:', coreError.message);
      return null;
    }
    return (core as Partial<UserPreferences>) ?? null;
  } catch {
    // Appearance must never be the reason a page fails to render.
    return null;
  }
}

/**
 * Applies the cached theme before first paint when the server had nothing to
 * go on — the login screen, or a PWA launched while the session cookie is
 * still being read. Runs synchronously in <head>, so there is no flash.
 */
const PREPAINT = `(function(){try{
if(document.documentElement.dataset.themeSource==='server')return;
var c=JSON.parse(localStorage.getItem('ruang_theme_cache')||'null');if(!c)return;
var r=document.documentElement;
Object.keys(c.attrs||{}).forEach(function(k){r.setAttribute(k,c.attrs[k])});
Object.keys(c.vars||{}).forEach(function(k){r.style.setProperty(k,c.vars[k])});
}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const preferences = await loadPreferences();
  const resolved = resolveTheme(preferences);

  return (
    <html
      lang="en"
      // Rendering the resolved palette here — not in a client effect — is what
      // makes the theme survive a reload. `data-theme-source` tells the
      // pre-paint script to stand down when these values are authoritative.
      {...themeAttributes(resolved)}
      data-theme-source={preferences ? 'server' : 'cache'}
      style={resolved.vars as React.CSSProperties}
    >
      <head>
        <meta name="theme-color" content={browserThemeColor(resolved)} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,300;0,400;0,500;1,400&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/logo/ruang-icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      </head>
      <body>
        <Providers preferences={preferences}>{children}</Providers>
      </body>
    </html>
  );
}
