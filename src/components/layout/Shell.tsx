import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { usePushNotifications } from '@/hooks/usePushNotifications';

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [kbInset, setKbInset] = useState(0);
  usePushNotifications();

  // Track the iOS keyboard inset via the visualViewport API. Capacitor's
  // Keyboard plugin runs with resize: 'body', which shrinks <body> but does
  // NOT shrink elements positioned with `fixed inset-0` — those still anchor
  // to the layout viewport, which is why the message input sits behind the
  // keyboard. By measuring (window.innerHeight - visualViewport.height) and
  // applying it as `bottom`, the Shell's bottom edge recedes with the
  // keyboard and the inner flex column keeps the input visible.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbInset(inset);
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div
      className="fixed inset-x-0 top-0 flex flex-col bg-slate-50"
      style={{ bottom: `${kbInset}px` }}
    >
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
