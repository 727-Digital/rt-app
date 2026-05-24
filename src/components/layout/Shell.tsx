import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { HelpChatWidget } from '@/components/help/HelpChatWidget';
import { isNative } from '@/lib/capacitor';
import { usePushNotifications } from '@/hooks/usePushNotifications';

function Shell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [kbInset, setKbInset] = useState(0);
  usePushNotifications();

  // Drive the keyboard inset directly from Capacitor's Keyboard plugin on
  // iOS. visualViewport is unreliable inside WKWebView with resize: 'body'
  // (it sometimes reports the unshrunken WKWebView frame rather than the
  // keyboard-reduced area). The native Keyboard listeners give us the exact
  // pixel height from UIKit.
  //
  // On web we still want graceful behavior, so fall back to visualViewport.
  // After updating the inset, scroll the focused input into view so the
  // user can see what they're typing inside scrollable <main>.
  useEffect(() => {
    function scrollActiveIntoView() {
      const active = document.activeElement as HTMLElement | null;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.isContentEditable)
      ) {
        requestAnimationFrame(() => {
          active.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
      }
    }

    if (isNative) {
      let showHandle: { remove: () => void } | undefined;
      let hideHandle: { remove: () => void } | undefined;
      (async () => {
        const { Keyboard } = await import('@capacitor/keyboard');
        showHandle = await Keyboard.addListener('keyboardWillShow', (info) => {
          setKbInset(info.keyboardHeight);
          scrollActiveIntoView();
        });
        hideHandle = await Keyboard.addListener('keyboardWillHide', () => {
          setKbInset(0);
        });
      })();
      return () => {
        showHandle?.remove();
        hideHandle?.remove();
      };
    }

    // Web fallback — visualViewport tracking.
    const vv = window.visualViewport;
    if (!vv) return;
    let lastInset = 0;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKbInset(inset);
      if (inset > lastInset + 20) scrollActiveIntoView();
      lastInset = inset;
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
      {/* Floating help bot — codebase-aware Q&A, available on every authed route */}
      <HelpChatWidget />
    </div>
  );
}

export { Shell };
