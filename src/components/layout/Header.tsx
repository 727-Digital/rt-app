import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';

interface HeaderProps {
  onMenuToggle: () => void;
}

function Header({ onMenuToggle }: HeaderProps) {
  const { isPlatformAdmin } = useAuth();
  const { org } = useOrg();

  const brandName = isPlatformAdmin ? 'TurfFlow' : org?.name || 'TurfFlow';
  const primaryColor = org?.primary_color || '#059669';

  return (
    <header className="fixed top-0 z-40 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
      <button
        onClick={onMenuToggle}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Menu size={20} />
      </button>
      {!isPlatformAdmin && org?.logo_url ? (
        <img src={org.logo_url} alt={brandName} className="h-7 object-contain" />
      ) : (
        <span className="text-lg font-bold" style={{ color: primaryColor }}>
          {brandName}
        </span>
      )}
      <div className="w-9" />
    </header>
  );
}

export { Header };
export type { HeaderProps };
