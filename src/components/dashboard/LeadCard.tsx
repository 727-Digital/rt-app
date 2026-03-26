import { cn, formatCurrency, formatRelativeTime, formatSqft } from '@/lib/utils';
import type { Lead } from '@/lib/types';
import { LEAD_STATUS_CONFIG } from '@/lib/types';

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

const STATUS_BORDER_COLORS: Record<string, string> = {
  'bg-emerald-100 text-emerald-800': 'border-l-emerald-500',
  'bg-blue-100 text-blue-800': 'border-l-blue-500',
  'bg-amber-100 text-amber-800': 'border-l-amber-500',
  'bg-slate-100 text-slate-800': 'border-l-slate-400',
};

function LeadCard({ lead, onClick }: LeadCardProps) {
  const config = LEAD_STATUS_CONFIG[lead.status];
  const borderColor = STATUS_BORDER_COLORS[config.color] ?? 'border-l-slate-300';

  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border border-slate-200 border-l-[3px] bg-white p-3 transition-all hover:shadow-sm',
        borderColor
      )}
      onClick={onClick}
    >
      <p className="text-sm font-medium text-slate-900">{lead.name}</p>
      <p className="truncate text-xs text-slate-500">{lead.address}</p>
      <div className="mt-2 flex items-center gap-2">
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {formatSqft(lead.sqft)}
        </span>
        <span className="text-xs text-slate-600">
          {formatCurrency(lead.estimate_min)} &ndash; {formatCurrency(lead.estimate_max)}
        </span>
      </div>
      <div className="mt-2 flex justify-end">
        <span className="text-xs text-slate-400">{formatRelativeTime(lead.created_at)}</span>
      </div>
    </div>
  );
}

export { LeadCard };
