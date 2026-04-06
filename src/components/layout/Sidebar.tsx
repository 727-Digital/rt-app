import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Users, FileText, GraduationCap, Building2, DollarSign, Settings, LogOut, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { to: '/leads', label: 'Leads', icon: Users, adminOnly: false },
  { to: '/messages', label: 'Messages', icon: MessageSquare, adminOnly: false },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, adminOnly: false },
  { to: '/quotes', label: 'Quotes', icon: FileText, adminOnly: false },
  { to: '/training', label: 'Training', icon: GraduationCap, adminOnly: false },
  { to: '/organizations', label: 'Organizations', icon: Building2, adminOnly: true },
  { to: '/financials', label: 'Financials', icon: DollarSign, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: false },
] as const;

function Sidebar() {
  const { user, isPlatformAdmin, signOut } = useAuth();
  const { org } = useOrg();

  const brandName = isPlatformAdmin ? 'ReliableTurf' : org?.name || 'ReliableTurf';
  const primaryColor = org?.primary_color || '#059669';

  return (
    <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="p-6">
        {!isPlatformAdmin && org?.logo_url ? (
          <img src={org.logo_url} alt={brandName} className="h-8 object-contain" />
        ) : (
          <span className="text-xl font-bold" style={{ color: primaryColor }}>
            {brandName}
          </span>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {navItems.filter(({ adminOnly }) => !adminOnly || isPlatformAdmin).map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'text-white'
                  : 'text-slate-600 hover:bg-slate-50',
              )
            }
            style={({ isActive }) =>
              isActive ? { backgroundColor: `${primaryColor}15`, color: primaryColor } : undefined
            }
          >
            <Icon size={20} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-3">
        {user?.email && (
          <p className="mb-2 truncate px-4 text-xs text-slate-400">{user.email}</p>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

export { Sidebar };
