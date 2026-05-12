import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  CheckCircle2,
  FileText,
  Image,
  Mail,
  MapPin,
  MessageSquare,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
import { ZoomableImage } from '@/components/ui/ZoomableImage';
import { StatusTransition } from '@/components/leads/StatusTransition';
import { LeadTimeline } from '@/components/leads/LeadTimeline';
import { ReviewSection } from '@/components/leads/ReviewSection';
import { MessageThread } from '@/components/leads/MessageThread';
import { CallButton } from '@/components/leads/CallButton';
import { ScheduleAppointment } from '@/components/leads/ScheduleAppointment';
import { PhotoCapture } from '@/components/leads/PhotoCapture';
import { BeforeAfterGallery } from '@/components/leads/BeforeAfterGallery';
import { CloseLeadModal } from '@/components/leads/CloseLeadModal';
import { PaymentQR } from '@/components/quotes/PaymentQR';
import { SMSPaymentLink } from '@/components/quotes/SMSPaymentLink';
import { useNotificationsForLead } from '@/hooks/useNotifications';
import { fetchLead, readCachedLead, updateLead, updateLeadStatus } from '@/lib/queries/leads';
import { fetchQuotesForLead } from '@/lib/queries/quotes';
import { supabase } from '@/lib/supabase';
import { LEAD_STATUS_CONFIG, type Lead, type LeadStatus, type Quote } from '@/lib/types';
import { cn, formatCurrency, formatDate, formatSqft } from '@/lib/utils';
import { formatDistanceToNow, parseISO } from 'date-fns';

const STATUS_BADGE_MAP: Record<string, BadgeVariant> = {
  'bg-emerald-100 text-emerald-800': 'emerald',
  'bg-blue-100 text-blue-800': 'blue',
  'bg-amber-100 text-amber-800': 'amber',
  'bg-slate-100 text-slate-800': 'slate',
};

function getStatusBadgeVariant(status: LeadStatus): BadgeVariant {
  const color = LEAD_STATUS_CONFIG[status].color;
  return STATUS_BADGE_MAP[color] ?? 'slate';
}

const STATUS_AFTER_SITE_VISIT: LeadStatus[] = [
  'site_visit_complete',
  'quote_sent',
  'quote_viewed',
  'quote_approved',
  'install_scheduled',
  'install_complete',
  'review_requested',
  'review_received',
  'closed',
];

const REVIEW_VISIBLE_STATUSES: LeadStatus[] = [
  'install_complete',
  'review_requested',
  'review_received',
  'closed',
];

type DetailTab = 'messages' | 'photos' | 'timeline';

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Optimistic render: if we've opened this lead before (cached in
  // localStorage within the last 24h), paint it immediately while the
  // network refresh runs in the background. Kills the cold-start spinner
  // when a rep taps a push notification.
  const cached = id ? readCachedLead(id) : null;
  const [lead, setLead] = useState<Lead | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [statusLoading, setStatusLoading] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('messages');
  const [scheduleModalType, setScheduleModalType] = useState<
    'site_visit' | 'install' | null
  >(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [approvedQuote, setApprovedQuote] = useState<Quote | null>(null);

  const { notifications, loading: notificationsLoading } = useNotificationsForLead(id!);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const load = useCallback(async () => {
    if (!id) return;
    // Only show the full-screen spinner if we have NOTHING to display yet.
    // When the cache hydrated `lead` synchronously, the refresh happens
    // silently in the background — no flash.
    const hasOptimisticLead = lead?.id === id;
    if (!hasOptimisticLead) setLoading(true);
    try {
      const data = await fetchLead(id);
      setLead(data);
      setNotesValue(data.notes ?? '');

      const quotes = await fetchQuotesForLead(id);
      const approved = quotes.find((q) => q.status === 'approved');
      setApprovedQuote(approved ?? null);
    } finally {
      setLoading(false);
    }
  }, [id, lead?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(newStatus: LeadStatus) {
    if (!lead) return;
    if (newStatus === 'closed') {
      setShowCloseModal(true);
      return;
    }
    try {
      setStatusLoading(true);
      const updated = await updateLeadStatus(lead.id, newStatus);
      setLead(updated);

      if (newStatus === 'quote_sent') {
        try {
          const quotes = await fetchQuotesForLead(lead.id);
          const latestQuote = quotes[0];
          if (latestQuote) {
            await supabase.functions.invoke('send-quote', {
              body: { quote_id: latestQuote.id },
            });
            showToast('Quote sent to customer');
          } else {
            showToast('Status updated (no quote found to send)');
          }
        } catch {
          showToast('Status updated but failed to send quote email');
        }
        return;
      }

      if (newStatus === 'review_requested') {
        try {
          await supabase.functions.invoke('request-review', {
            body: { lead_id: lead.id },
          });
          showToast('Review request sent');
        } catch {
          showToast('Status updated but failed to send review request');
        }
        return;
      }

      if (newStatus === 'install_complete') {
        showToast('Install complete — you can now request a review below');
        return;
      }

      showToast('Status updated');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleSaveNotes() {
    if (!lead) return;
    try {
      setNotesSaving(true);
      const updated = await updateLead(lead.id, { notes: notesValue || null });
      setLead(updated);
      showToast('Notes saved');
    } finally {
      setNotesSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size={28} />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-500">Lead not found.</p>
        <Link to="/leads" className="mt-2 text-sm text-emerald-600 hover:underline">
          Back to Leads
        </Link>
      </div>
    );
  }

  const showCreateQuote = STATUS_AFTER_SITE_VISIT.includes(lead.status);
  const showReviewSection = REVIEW_VISIBLE_STATUSES.includes(lead.status);

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      <Link to="/leads">
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} />
          Back to Leads
        </Button>
      </Link>

      <div className="mt-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
        <h1 className="text-2xl font-bold text-slate-900">{lead.name}</h1>
        <Badge variant={getStatusBadgeVariant(lead.status)}>
          {LEAD_STATUS_CONFIG[lead.status].label}
        </Badge>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-4 text-sm text-slate-500">
        <a
          href={`https://maps.google.com/?q=${encodeURIComponent(lead.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors"
        >
          <MapPin size={14} />
          {lead.address}
        </a>
        <CallButton
          phone={lead.phone}
          leadId={lead.id}
          leadCreatedAt={lead.created_at}
          firstResponseAt={lead.first_response_at}
          onFirstResponse={load}
        />
        <a
          href={`mailto:${lead.email}`}
          className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors"
        >
          <Mail size={14} />
          {lead.email}
        </a>
      </div>

      <div className="mt-2">
        {lead.first_response_at && lead.response_time_seconds != null ? (
          <p className={cn(
            'text-sm font-medium',
            lead.response_time_seconds < 300 ? 'text-emerald-600' :
            lead.response_time_seconds < 1800 ? 'text-amber-600' : 'text-red-600',
          )}>
            First response: {lead.response_time_seconds < 60
              ? `${lead.response_time_seconds}s`
              : lead.response_time_seconds < 3600
                ? `${Math.round(lead.response_time_seconds / 60)} min`
                : `${Math.floor(lead.response_time_seconds / 3600)} hr ${Math.round((lead.response_time_seconds % 3600) / 60)} min`
            } after lead submitted
          </p>
        ) : (
          <p className="text-sm font-medium text-red-500">
            No response yet — {formatDistanceToNow(parseISO(lead.created_at))} ago
          </p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <h3 className="text-sm font-semibold text-slate-900">Property Info</h3>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Square Footage</span>
              <span className="font-medium text-slate-900">{formatSqft(lead.sqft)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Estimate Range</span>
              <span className="font-medium text-slate-900">
                {formatCurrency(lead.estimate_min)} - {formatCurrency(lead.estimate_max)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Source</span>
              <span className="font-medium text-slate-900 capitalize">{lead.source}</span>
            </div>
            {lead.satellite_image_url ? (
              <ZoomableImage
                src={lead.satellite_image_url}
                alt="Aerial view"
                className="mt-2"
              />
            ) : (
              <div className="mt-2 flex items-center justify-center rounded-lg border border-dashed border-slate-200 py-8 text-sm text-slate-400">
                <Image size={16} className="mr-2" />
                No aerial image available
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900">Schedule</h3>
          <div className="mt-3 flex flex-col gap-4">
            {/* Site Visit slot */}
            <ScheduleSlot
              label="Site Visit"
              scheduledAt={lead.site_visit_date}
              isComplete={STATUS_AFTER_SITE_VISIT.includes(lead.status)}
              variant="emerald"
              onSchedule={() => setScheduleModalType('site_visit')}
              onComplete={() => handleStatusChange('site_visit_complete')}
            />
            {/* Install slot */}
            <ScheduleSlot
              label="Install"
              scheduledAt={lead.install_date}
              isComplete={lead.status === 'install_complete'}
              variant="blue"
              onSchedule={() => setScheduleModalType('install')}
              onComplete={() => handleStatusChange('install_complete')}
            />
            <div className="border-t border-slate-100 pt-3 text-xs text-slate-400">
              Lead created {formatDate(lead.created_at)}
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <h3 className="text-sm font-semibold text-slate-900">Status</h3>
        <div className="mt-3">
          <StatusTransition
            currentStatus={lead.status}
            onStatusChange={handleStatusChange}
            loading={statusLoading}
          />
        </div>
      </Card>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {showCreateQuote && (
          <Button
            variant="primary"
            onClick={() => navigate(`/quotes/new/${lead.id}`)}
          >
            <FileText size={16} />
            Create Quote
          </Button>
        )}
        {approvedQuote && (
          <>
            <PaymentQR quoteId={approvedQuote.id} total={approvedQuote.total} />
            <SMSPaymentLink
              quoteId={approvedQuote.id}
              leadId={lead.id}
              leadPhone={lead.phone}
              total={approvedQuote.total}
              orgId={lead.org_id}
            />
          </>
        )}
      </div>

      <Card className="mt-4">
        <div className="flex items-center gap-1 border-b border-slate-200 pb-3">
          {([
            { key: 'messages' as const, label: 'Messages', icon: MessageSquare },
            { key: 'photos' as const, label: 'Photos', icon: Camera },
            { key: 'timeline' as const, label: 'Timeline', icon: FileText },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                activeTab === key
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-slate-500 hover:bg-slate-50',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {activeTab === 'messages' && (
            <MessageThread
              leadId={lead.id}
              leadPhone={lead.phone}
              orgId={lead.org_id}
              leadCreatedAt={lead.created_at}
              firstResponseAt={lead.first_response_at}
              onFirstResponse={load}
            />
          )}
          {activeTab === 'photos' && (
            <div className="flex flex-col gap-6">
              <PhotoCapture leadId={lead.id} orgId={lead.org_id} type="before" />
              <PhotoCapture leadId={lead.id} orgId={lead.org_id} type="after" />
            </div>
          )}
          {activeTab === 'timeline' && (
            notificationsLoading ? (
              <div className="flex justify-center py-4">
                <Spinner size={20} />
              </div>
            ) : (
              <LeadTimeline lead={lead} notifications={notifications} />
            )
          )}
        </div>
      </Card>

      <Card className="mt-4">
        <h3 className="text-sm font-semibold text-slate-900">Notes</h3>
        <div className="mt-3 flex flex-col gap-3">
          <Textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            rows={4}
            placeholder="Add notes about this lead..."
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="secondary"
              loading={notesSaving}
              onClick={handleSaveNotes}
            >
              <Save size={14} />
              Save Notes
            </Button>
          </div>
        </div>
      </Card>

      {showReviewSection && (
        <ReviewSection leadId={lead.id} leadStatus={lead.status} leadName={lead.name} leadPhone={lead.phone} orgId={lead.org_id} />
      )}

      <BeforeAfterGallery leadId={lead.id} />

      {scheduleModalType && (
        <ScheduleAppointment
          leadId={lead.id}
          orgId={lead.org_id}
          leadName={lead.name}
          type={scheduleModalType}
          isReschedule={
            scheduleModalType === 'install'
              ? !!lead.install_date
              : !!lead.site_visit_date
          }
          open={!!scheduleModalType}
          onClose={() => setScheduleModalType(null)}
          onScheduled={() => {
            showToast(
              scheduleModalType === 'install'
                ? 'Install scheduled'
                : 'Site visit scheduled',
            );
            load();
          }}
        />
      )}

      {showCloseModal && (
        <CloseLeadModal
          leadId={lead.id}
          currentStatus={lead.status}
          onClose={() => setShowCloseModal(false)}
          onClosed={() => {
            showToast('Lead closed');
            load();
            setShowCloseModal(false);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One row in the Schedule card. Three states a rep ever sees:
//   1. Nothing scheduled  →  big colored "Schedule X" button
//   2. Scheduled          →  date badge + prominent "Mark Complete" + small Reschedule link
//   3. Complete           →  grey-checked card, no actions
// ---------------------------------------------------------------------------

interface ScheduleSlotProps {
  label: string;
  scheduledAt: string | null | undefined;
  isComplete: boolean;
  variant: 'emerald' | 'blue';
  onSchedule: () => void;
  onComplete: () => void;
}

function formatScheduledDay(scheduledAt: string): string {
  // Local-date parse: avoid timezone shift from naive new Date('YYYY-MM-DD')
  const datePart = scheduledAt.split('T')[0] ?? '';
  const parts = datePart.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function ScheduleSlot({
  label,
  scheduledAt,
  isComplete,
  variant,
  onSchedule,
  onComplete,
}: ScheduleSlotProps) {
  const color =
    variant === 'emerald'
      ? {
          ring: 'border-emerald-200',
          bg: 'bg-emerald-50',
          icon: 'text-emerald-600',
          label: 'text-emerald-900',
          link: 'text-emerald-700',
          btn: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800',
        }
      : {
          ring: 'border-blue-200',
          bg: 'bg-blue-50',
          icon: 'text-blue-600',
          label: 'text-blue-900',
          link: 'text-blue-700',
          btn: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
        };

  // State 3: complete
  if (isComplete) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
        <div className="flex-1 text-sm">
          <p className="font-semibold text-slate-700">{label} complete</p>
          {scheduledAt && (
            <p className="text-xs text-slate-500">{formatScheduledDay(scheduledAt)}</p>
          )}
        </div>
      </div>
    );
  }

  // State 2: scheduled. The next action the rep should take here is
  // "Mark Complete" once the visit/install has happened, so promote it to
  // the same prominence as the empty-state Schedule button. Reschedule
  // drops to a small text link.
  if (scheduledAt) {
    return (
      <div className={`rounded-lg border ${color.ring} ${color.bg} p-3`}>
        <div className="flex items-start gap-2">
          <CalendarDays size={18} className={`mt-0.5 shrink-0 ${color.icon}`} />
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium uppercase tracking-wide ${color.link}`}>
              {label} scheduled
            </p>
            <p className={`mt-0.5 text-base font-semibold ${color.label}`}>
              {formatScheduledDay(scheduledAt)}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onComplete}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg ${color.btn} px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors`}
        >
          <CheckCircle2 size={18} />
          Mark {label} Complete
        </button>
        <button
          type="button"
          onClick={onSchedule}
          className={`mt-2 self-start text-xs font-medium underline-offset-2 hover:underline ${color.link}`}
        >
          Reschedule
        </button>
      </div>
    );
  }

  // State 1: nothing scheduled
  return (
    <button
      type="button"
      onClick={onSchedule}
      className={`flex w-full items-center justify-center gap-2 rounded-lg ${color.btn} px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors`}
    >
      <CalendarDays size={18} />
      Schedule {label}
    </button>
  );
}
