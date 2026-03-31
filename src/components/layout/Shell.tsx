import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { usePushNotifications } from '@/hooks/usePushNotifications';

function Shell() {
  const [_menuOpen, setMenuOpen] = useState(false);
  usePushNotifications();

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <Header onMenuToggle={() => setMenuOpen((prev) => !prev)} />
      <MobileNav />
      <main className="lg:pt-0 lg:pb-0 lg:pl-64" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))', paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export { Shell };
