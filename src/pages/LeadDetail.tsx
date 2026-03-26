import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Mail,
  MapPin,
  Phone,
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
import { useNotificationsForLead } from '@/hooks/useNotifications';
import { fetchLead, updateLead, updateLeadStatus } from '@/lib/queries/leads';
import { fetchQuotesForLead } from '@/lib/queries/quotes';
import { supabase } from '@/lib/supabase';
import { LEAD_STATUS_CONFIG, type Lead, type LeadStatus } from '@/lib/types';
import { formatCurrency, formatDate, formatSqft } from '@/lib/utils';

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
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(newStatus: LeadStatus) {
    if (!lead) return;
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
        <span className="inline-flex items-center gap-1">
          <MapPin size={14} />
          {lead.address}
        </span>
        <span className="inline-flex items-center gap-1">
          <Phone size={14} />
          {lead.phone}
        </span>
        <span className="inline-flex items-center gap-1">
          <Mail size={14} />
          {lead.email}
        </span>
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
            {lead.satellite_image_url && (
              <img
                src={lead.satellite_image_url}
                alt="Satellite view"
                className="mt-2 rounded-lg border border-slate-200"
              />
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
            <Button
              size="sm"
              variant="secondary"
              loading={dateSaving}
              onClick={handleSaveDates}
            >
              <Save size={14} />
              Save Dates
            </Button>
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

      <div className="mt-4 flex flex-col gap-4 md:flex-row">
        {showCreateQuote && (
          <Button
            variant="primary"
            onClick={() => navigate(`/quotes/new/${lead.id}`)}
          >
            <FileText size={16} />
            Create Quote
          </Button>
        )}
      </div>

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

      <Card className="mt-4">
        <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
        <div className="mt-4">
          {notificationsLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size={20} />
            </div>
          ) : (
            <LeadTimeline lead={lead} notifications={notifications} />
          )}
        </div>
      </Card>

      {showReviewSection && (
        <ReviewSection leadId={lead.id} leadStatus={lead.status} />
      )}
    </div>
  );
}
