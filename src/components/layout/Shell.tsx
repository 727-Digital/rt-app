import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';

function Shell() {
  const [_menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <Header onMenuToggle={() => setMenuOpen((prev) => !prev)} />
      <MobileNav />
      <main className="pt-14 pb-16 lg:pt-0 lg:pb-0 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export { Shell };
