import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/quotes', label: 'Quotes', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

function MobileNav() {
  return (
    <nav className="fixed bottom-0 z-40 flex h-16 w-full items-center justify-around border-t border-slate-200 bg-white lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1',
              isActive ? 'text-emerald-600' : 'text-slate-400',
            )
          }
        >
          <Icon size={20} />
          <span className="text-xs">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export { MobileNav };
