import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { usePushNotifications } from '@/hooks/usePushNotifications';

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  usePushNotifications();

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50">
      <Sidebar />
      <MobileSidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      {/* Mobile header — static flex item, z-40 to stay above content but below open drawer */}
      <div className="relative z-40 shrink-0 lg:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <Header onMenuToggle={() => setMenuOpen((prev) => !prev)} />
      </div>
      {/* Desktop spacer for sidebar */}
      <main className="flex-1 overflow-y-auto lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </div>
      </main>
      {/* Mobile bottom nav — static flex item */}
      <MobileNav />
    </div>
  );
}

export { Shell };
