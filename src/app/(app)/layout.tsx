'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { FAB } from '@/components/layout/FAB';
import { KeyboardShortcutsPanel } from '@/components/layout/KeyboardShortcutsPanel';
import { PreferencesProvider } from '@/lib/preferences';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  const toggleFocusMode = useCallback(() => setFocusMode((v) => !v), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const editable = (e.target as HTMLElement)?.isContentEditable;
      if (tag === 'input' || tag === 'textarea' || editable) return;
      if (e.key === '?') { e.preventDefault(); setShowShortcuts((v) => !v); }
      if (e.key === 'f' || e.key === 'F') { e.preventDefault(); setFocusMode((v) => !v); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const user = session.user as { name?: string; email?: string; image?: string; id?: string };
  const isNote = pathname?.startsWith('/note');

  return (
    <PreferencesProvider>
      <div className="min-h-screen bg-bg-base">
        {/* Desktop */}
        <div className="hidden md:block">
          <TopNavbar
            userName={user.name || ''}
            userImage={user.image}
            focusMode={focusMode}
            onToggleFocusMode={toggleFocusMode}
            onShowShortcuts={() => setShowShortcuts(true)}
          />
          {!focusMode && <Sidebar />}
          <main
            className="mt-[52px] min-h-[calc(100vh-52px)] transition-all duration-220"
            style={{ marginLeft: focusMode ? 0 : 208 }}
          >
            <div className="animate-fadeUp">{children}</div>
          </main>
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <MobileHeader
            inNote={isNote}
            onHamburger={() => setDrawerOpen(true)}
            userName={user.name || ''}
            userImage={user.image}
          />
          <MobileDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            userName={user.name || ''}
            userEmail={user.email || ''}
          />
          <main className={`${isNote ? 'pt-14' : 'pt-14 pb-16'} min-h-screen`}>
            <div className="animate-fadeUp">{children}</div>
          </main>
          {!isNote && <MobileTabBar />}
        </div>

        <FAB />

        {showShortcuts && <KeyboardShortcutsPanel onClose={() => setShowShortcuts(false)} />}
      </div>
    </PreferencesProvider>
  );
}
