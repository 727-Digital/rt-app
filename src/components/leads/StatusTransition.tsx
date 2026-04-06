import { ChevronRight, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { LeadStatus } from '@/lib/types';
import { LEAD_STATUS_CONFIG } from '@/lib/types';

interface StatusTransitionProps {
  currentStatus: LeadStatus;
  onStatusChange: (newStatus: LeadStatus) => void;
  loading?: boolean;
}

const STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new_lead: ['site_visit_scheduled'],
  site_visit_scheduled: ['site_visit_complete'],
  site_visit_complete: ['quote_sent'],
  quote_sent: ['quote_viewed', 'quote_approved'],
  quote_viewed: ['quote_approved'],
  quote_approved: ['deposit_paid'],
  deposit_paid: ['install_scheduled'],
  install_scheduled: ['install_complete'],
  install_complete: ['review_requested'],
  review_requested: ['review_received'],
  review_received: ['closed'],
  closed: [],
};

function StatusTransition({ currentStatus, onStatusChange, loading }: StatusTransitionProps) {
  const transitions = STATUS_TRANSITIONS[currentStatus];
  const [primary, ...alternatives] = transitions;

  if (currentStatus === 'closed' && transitions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary && (
        <Button
          size="sm"
          variant="primary"
          loading={loading}
          onClick={() => onStatusChange(primary)}
        >
          <ChevronRight size={14} />
          {LEAD_STATUS_CONFIG[primary].label}
        </Button>
      )}
      {alternatives.map((status) => (
        <Button
          key={status}
          size="sm"
          variant="ghost"
          loading={loading}
          onClick={() => onStatusChange(status)}
        >
          {LEAD_STATUS_CONFIG[status].label}
        </Button>
      ))}
      {currentStatus !== 'closed' && (
        <Button
          size="sm"
          variant="ghost"
          loading={loading}
          onClick={() => onStatusChange('closed')}
        >
          <XCircle size={14} />
          Close
        </Button>
      )}
    </div>
  );
}

export { StatusTransition };
