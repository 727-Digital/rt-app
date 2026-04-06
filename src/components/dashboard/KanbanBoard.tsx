import { useMemo } from 'react';
import { PIPELINE_STAGES } from '@/lib/types';
import type { Lead, LeadStatus } from '@/lib/types';
import { PipelineColumn } from './PipelineColumn';

interface KanbanBoardProps {
  leads: Lead[];
  onLeadClick: (lead: Lead) => void;
}

const KEY_STAGES = new Set<LeadStatus>([
  'new_lead',
  'quote_sent',
  'quote_approved',
  'deposit_paid',
  'install_scheduled',
]);

function KanbanBoard({ leads, onLeadClick }: KanbanBoardProps) {
  const grouped = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>();
    for (const stage of PIPELINE_STAGES) {
      map.set(stage, []);
    }
    for (const lead of leads) {
      map.get(lead.status)?.push(lead);
    }
    return map;
  }, [leads]);

  const visibleStages = PIPELINE_STAGES.filter(
    (stage) => KEY_STAGES.has(stage) || (grouped.get(stage)?.length ?? 0) > 0
  );

  return (
    <div className="flex flex-col gap-4 md:flex-row md:overflow-x-auto md:pb-4">
      {visibleStages.map((stage) => (
        <PipelineColumn
          key={stage}
          status={stage}
          leads={grouped.get(stage) ?? []}
          onLeadClick={onLeadClick}
        />
      ))}
    </div>
  );
}

export { KanbanBoard };
