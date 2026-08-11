'use client';

import { SessionProvider } from 'next-auth/react';
import { PreferencesProvider } from '@/lib/preferences';
import type { UserPreferences } from '@/lib/theme';

export function Providers({
  children,
  preferences,
}: {
  children: React.ReactNode;
  preferences?: Partial<UserPreferences> | null;
}) {
  return (
    <SessionProvider>
      {/*
        Appearance lives at the root, not inside the app shell: /login and
        /signup are outside (app)/ and still need the palette, and the settings
        page needs to read the user's real saved values rather than defaults.
      */}
      <PreferencesProvider initialPreferences={preferences}>{children}</PreferencesProvider>
    </SessionProvider>
  );
}
