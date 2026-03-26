import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: number;
  className?: string;
}

function Spinner({ size = 20, className }: SpinnerProps) {
  return <Loader2 size={size} className={cn('animate-spin text-slate-400', className)} />;
}

export { Spinner };
export type { SpinnerProps };
