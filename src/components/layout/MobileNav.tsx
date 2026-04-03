import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, FileText, DollarSign, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/messages', label: 'Messages', icon: MessageSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/quotes', label: 'Quotes', icon: FileText },
  { to: '/financials', label: 'Financials', icon: DollarSign },
] as const;

function MobileNav() {
  return (
    <nav className="mobile-nav fixed bottom-0 z-40 flex w-full items-center justify-around border-t border-slate-200 bg-white lg:hidden" style={{ height: 'calc(4rem + env(safe-area-inset-bottom))', paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
