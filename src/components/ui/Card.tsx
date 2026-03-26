import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4',
        onClick && 'cursor-pointer hover:border-slate-300 hover:shadow-sm transition-all',
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export { Card };
export type { CardProps };
