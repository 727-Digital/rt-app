import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';

interface HeaderProps {
  onMenuToggle: () => void;
}

function Header({ onMenuToggle }: HeaderProps) {
  const { isPlatformAdmin } = useAuth();
  const { org } = useOrg();

  const brandName = isPlatformAdmin ? 'ReliableTurf' : org?.name || 'ReliableTurf';
  const primaryColor = org?.primary_color || '#059669';

  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4">
      <button
        onClick={onMenuToggle}
        className="-ml-1 flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 active:bg-slate-100 transition-colors"
      >
        <Menu size={22} />
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
