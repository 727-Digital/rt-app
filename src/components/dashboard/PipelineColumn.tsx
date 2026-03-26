import { LEAD_STATUS_CONFIG } from '@/lib/types';
import type { Lead, LeadStatus } from '@/lib/types';
import { Badge } from '@/components/ui/Badge';
import { LeadCard } from './LeadCard';

interface PipelineColumnProps {
  status: LeadStatus;
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}

function PipelineColumn({ status, leads, onLeadClick }: PipelineColumnProps) {
  const config = LEAD_STATUS_CONFIG[status];

  return (
    <div className="w-full flex-shrink-0 rounded-xl bg-slate-50 p-3 md:min-w-[280px] md:max-w-[320px]">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-700">{config.label}</h3>
        <Badge variant="slate">{leads.length}</Badge>
      </div>
      <div className="mt-3 flex flex-col gap-2 overflow-y-auto" style={{ maxHeight: '60vh' }}>
        {leads.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">No leads</p>
        ) : (
          leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} />
          ))
        )}
      </div>
    </div>
  );
}

export { PipelineColumn };
