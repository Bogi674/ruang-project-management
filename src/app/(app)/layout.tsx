'use client';

import { useSession } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TopNavbar } from '@/components/layout/TopNavbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MobileTabBar } from '@/components/layout/MobileTabBar';
import { MobileDrawer } from '@/components/layout/MobileDrawer';
import { FAB } from '@/components/layout/FAB';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

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
    <div className="min-h-screen bg-bg-base">
      {/* Desktop */}
      <div className="hidden md:block">
        <TopNavbar userName={user.name || ''} userImage={user.image} />
        <Sidebar />
        <main className="ml-[208px] mt-[52px] min-h-[calc(100vh-52px)]">
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
    </div>
  );
}
