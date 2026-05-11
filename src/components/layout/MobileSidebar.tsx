import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { X, LayoutDashboard, CalendarDays, Users, UserCheck, FileText, GraduationCap, Building2, DollarSign, Settings, LogOut, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, adminOnly: false },
  { to: '/leads', label: 'Leads', icon: Users, adminOnly: false },
  { to: '/customers', label: 'Customers', icon: UserCheck, adminOnly: false },
  { to: '/messages', label: 'Messages', icon: MessageSquare, adminOnly: false },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, adminOnly: false },
  { to: '/quotes', label: 'Quotes', icon: FileText, adminOnly: false },
  { to: '/training', label: 'Training', icon: GraduationCap, adminOnly: false },
  { to: '/organizations', label: 'Organizations', icon: Building2, adminOnly: true },
  { to: '/financials', label: 'Financials', icon: DollarSign, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings, adminOnly: false },
] as const;

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const { user, isPlatformAdmin, signOut } = useAuth();
  const { org } = useOrg();
  const [mounted, setMounted] = useState(false);

  const brandName = isPlatformAdmin ? 'ReliableTurf' : org?.name || 'ReliableTurf';
  const primaryColor = org?.primary_color || '#059669';

  useEffect(() => {
    if (open) {
      setMounted(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      const timer = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(timer);
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!mounted && !open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 lg:hidden ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-white transition-transform duration-200 ease-out lg:hidden ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between p-4">
          {!isPlatformAdmin && org?.logo_url ? (
            <img src={org.logo_url} alt={brandName} className="h-8 object-contain" />
          ) : (
            <span className="text-xl font-bold" style={{ color: primaryColor }}>
              {brandName}
            </span>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {navItems
            .filter(({ adminOnly }) => !adminOnly || isPlatformAdmin)
            .map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'text-white' : 'text-slate-600 hover:bg-slate-50',
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

        <div className="border-t border-slate-200 p-3" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {user?.email && (
            <p className="mb-2 truncate px-4 text-xs text-slate-400">{user.email}</p>
          )}
          <button
            onClick={() => { onClose(); signOut(); }}
            className="flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

export { MobileSidebar };
