import {
  CalendarCheck,
  ChevronRight,
  DollarSign,
  Eye,
  FileCheck,
  Hammer,
  HandCoins,
  PartyPopper,
  Send,
  Star,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import type { LeadStatus } from '@/lib/types';

interface StatusTransitionProps {
  currentStatus: LeadStatus;
  onStatusChange: (newStatus: LeadStatus) => void;
  loading?: boolean;
}

// What appears on the BUTTON for "advance to this status" — phrased as
// the rep's action, not the database state. Third-grader-friendly.
const ACTION_LABEL: Record<
  LeadStatus,
  { label: string; Icon: React.ComponentType<{ size?: number }> }
> = {
  new_lead: { label: 'Reopen as New', Icon: ChevronRight },
  site_visit_scheduled: { label: 'Mark Visit Scheduled', Icon: CalendarCheck },
  site_visit_complete: { label: 'Mark Visit Complete', Icon: CalendarCheck },
  quote_sent: { label: 'Mark Quote Sent', Icon: Send },
  quote_viewed: { label: 'Mark Quote Viewed', Icon: Eye },
  quote_approved: { label: 'Mark Quote Approved', Icon: ThumbsUp },
  deposit_paid: { label: 'Mark Deposit Paid', Icon: DollarSign },
  install_scheduled: { label: 'Mark Install Scheduled', Icon: Hammer },
  install_complete: { label: 'Mark Install Complete', Icon: Hammer },
  review_requested: { label: 'Request Review', Icon: Star },
  review_received: { label: 'Mark Review Received', Icon: Star },
  closed: { label: 'Close', Icon: XCircle },
};

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

// What's the BIG prompt above the buttons? Tells the rep exactly what to do next.
const NEXT_STEP_PROMPT: Partial<Record<LeadStatus, string>> = {
  new_lead: 'Call the customer and schedule their site visit.',
  site_visit_scheduled: 'When the visit happens, mark it complete below.',
  site_visit_complete: 'Build them a quote.',
  quote_sent: "Waiting on the customer to view or approve.",
  quote_viewed: 'They opened the quote — give them a nudge to approve.',
  quote_approved: 'Collect the deposit, then schedule the install.',
  deposit_paid: "Pick a day for install — they're paid up.",
  install_scheduled: 'Crew shows up — mark install complete after.',
  install_complete: "Ask the customer for a Google review.",
  review_requested: 'Watching for the review to come in.',
  review_received: 'Time to close this deal as a win.',
};

function StatusTransition({ currentStatus, onStatusChange, loading }: StatusTransitionProps) {
  const transitions = STATUS_TRANSITIONS[currentStatus];
  const [primary, ...alternatives] = transitions;

  if (currentStatus === 'closed') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
        <PartyPopper size={18} className="shrink-0 text-emerald-600" />
        <p className="text-sm font-medium text-emerald-900">
          This lead is closed.
        </p>
      </div>
    );
  }

  const prompt = NEXT_STEP_PROMPT[currentStatus];
  const primaryAction = primary ? ACTION_LABEL[primary] : null;

  return (
    <div className="flex flex-col gap-3">
      {prompt && (
        <p className="text-sm text-slate-600">
          <span className="font-semibold text-slate-900">Next step:</span> {prompt}
        </p>
      )}

      {primary && primaryAction && (
        <button
          type="button"
          onClick={() => onStatusChange(primary)}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50"
        >
          <primaryAction.Icon size={18} />
          {primaryAction.label}
        </button>
      )}

      {alternatives.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alternatives.map((status) => {
            const action = ACTION_LABEL[status];
            return (
              <button
                key={status}
                type="button"
                onClick={() => onStatusChange(status)}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <action.Icon size={14} />
                {action.label}
              </button>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => onStatusChange('closed')}
        disabled={loading}
        className="flex items-center gap-1.5 self-start text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline disabled:opacity-50"
      >
        <XCircle size={12} />
        Close this lead
      </button>
    </div>
  );
}

// Re-export for callers that wanted the old icons. Keeps the public surface stable.
export { StatusTransition, HandCoins, FileCheck };
