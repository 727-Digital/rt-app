import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Camera,
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
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
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
import { fetchLead, updateLead, updateLeadStatus } from '@/lib/queries/leads';
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
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [siteVisitDate, setSiteVisitDate] = useState('');
  const [installDate, setInstallDate] = useState('');
  const [dateSaving, setDateSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [activeTab, setActiveTab] = useState<DetailTab>('messages');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [approvedQuote, setApprovedQuote] = useState<Quote | null>(null);

  const { notifications, loading: notificationsLoading } = useNotificationsForLead(id!);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await fetchLead(id);
      setLead(data);
      setNotesValue(data.notes ?? '');
      setSiteVisitDate(data.site_visit_date?.split('T')[0] ?? '');
      setInstallDate(data.install_date?.split('T')[0] ?? '');

      const quotes = await fetchQuotesForLead(id);
      const approved = quotes.find((q) => q.status === 'approved');
      setApprovedQuote(approved ?? null);
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  async function handleSaveDates() {
    if (!lead) return;
    try {
      setDateSaving(true);
      const updated = await updateLead(lead.id, {
        site_visit_date: siteVisitDate || null,
        install_date: installDate || null,
      });
      setLead(updated);
      showToast('Dates saved');
    } finally {
      setDateSaving(false);
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
              <a
                href={lead.satellite_image_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  src={lead.satellite_image_url}
                  alt="Aerial view"
                  className="mt-2 w-full cursor-pointer rounded-lg border border-slate-200 hover:opacity-90 transition-opacity"
                />
              </a>
            ) : (
              <div className="mt-2 flex items-center justify-center rounded-lg border border-dashed border-slate-200 py-8 text-sm text-slate-400">
                <Image size={16} className="mr-2" />
                No aerial image available
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-slate-900">Dates</h3>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Created</span>
              <span className="font-medium text-slate-900">{formatDate(lead.created_at)}</span>
            </div>
            <Input
              label="Site Visit Date"
              type="date"
              value={siteVisitDate}
              onChange={(e) => setSiteVisitDate(e.target.value)}
            />
            <Input
              label="Install Date"
              type="date"
              value={installDate}
              onChange={(e) => setInstallDate(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                loading={dateSaving}
                onClick={handleSaveDates}
              >
                <Save size={14} />
                Save Dates
              </Button>
              {lead.status === 'new_lead' && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setShowScheduleModal(true)}
                >
                  <CalendarDays size={14} />
                  Schedule Visit
                </Button>
              )}
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

      {showScheduleModal && (
        <ScheduleAppointment
          leadId={lead.id}
          orgId={lead.org_id}
          leadName={lead.name}
          open={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={() => {
            showToast('Appointment scheduled');
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
