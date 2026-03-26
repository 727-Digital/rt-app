import { Menu } from 'lucide-react';

interface HeaderProps {
  onMenuToggle: () => void;
}

function Header({ onMenuToggle }: HeaderProps) {
  return (
    <header className="fixed top-0 z-40 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
      <button
        onClick={onMenuToggle}
        className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <Menu size={20} />
      </button>
      <span className="text-lg font-bold text-emerald-600">TurfFlow</span>
      <div className="w-9" />
    </header>
  );
}

export { Header };
export type { HeaderProps };
