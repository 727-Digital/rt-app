import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  MessageSquare,
  QrCode,
  RefreshCw,
  Send,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { ReviewQRCard } from '@/components/reviews/ReviewQRCard';
import { ReferralRequest } from '@/components/leads/ReferralRequest';
import { fetchReviewsForLead } from '@/lib/queries/reviews';
import { supabase } from '@/lib/supabase';
import type { LeadStatus, Organization, Review } from '@/lib/types';
import { formatDate } from '@/lib/utils';

const REVIEW_VISIBLE_STATUSES: LeadStatus[] = [
  'install_complete',
  'review_requested',
  'review_received',
  'closed',
];

interface ReviewSectionProps {
  leadId: string;
  leadStatus: LeadStatus;
  leadName?: string;
  leadPhone?: string;
  orgId?: string | null;
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function buildReviewUrl(leadId: string): string {
  return `${window.location.origin}/review/${leadId}`;
}

function ReviewSection({ leadId, leadStatus, leadName, leadPhone, orgId }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [googleReviewUrl, setGoogleReviewUrl] = useState<string | null>(null);
  const [orgLoaded, setOrgLoaded] = useState(false);

  const reviewUrl = buildReviewUrl(leadId);

  useEffect(() => {
    if (!orgId) { setOrgLoaded(true); return; }
    supabase
      .from('organizations')
      .select('google_review_url')
      .eq('id', orgId)
      .single()
      .then(({ data }) => {
        if (data) setGoogleReviewUrl((data as Pick<Organization, 'google_review_url'>).google_review_url);
        setOrgLoaded(true);
      });
  }, [orgId]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchReviewsForLead(leadId);
      setReviews(data);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  function showMessage(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(''), 3000);
  }

  async function handleRequestReview() {
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('request-review', {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      showMessage('Review request sent!');
      await load();
    } catch {
      showMessage('Failed to send review request');
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('request-review', {
        body: { lead_id: leadId },
      });
      if (error) throw error;
      showMessage('Review request resent!');
      await load();
    } catch {
      showMessage('Failed to resend review request');
    } finally {
      setSending(false);
    }
  }

  function handleSendViaSMS() {
    if (!leadPhone) return;
    const url = googleReviewUrl || reviewUrl;
    const body = googleReviewUrl
      ? `Hi ${leadName || ''}, thank you for choosing us for your turf installation! We'd love to hear about your experience. Tap to leave a review: ${url}`
      : `Hi${leadName ? ` ${leadName}` : ''}! Thanks for choosing Reliable Turf! We'd love your feedback: ${url}`;
    window.open(`sms:${leadPhone}?body=${encodeURIComponent(body)}`);
  }

  async function handleCopyLink() {
    await navigator.clipboard.writeText(reviewUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  if (!REVIEW_VISIBLE_STATUSES.includes(leadStatus)) return null;

  if (loading) {
    return (
      <Card className="mt-4">
        <h3 className="text-sm font-semibold text-slate-900">Reviews</h3>
        <div className="mt-4 flex justify-center py-4">
          <Spinner size={20} />
        </div>
      </Card>
    );
  }

  const review = reviews[0] ?? null;
  const daysAgo = review?.sent_at ? daysSince(review.sent_at) : null;

  return (
    <>
      <Card className="mt-4">
        <h3 className="text-sm font-semibold text-slate-900">Reviews</h3>

        {message && (
          <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        <div className="mt-3">
          {orgLoaded && !googleReviewUrl && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle size={16} />
              Set your Google Review URL in Organization settings to enable review requests.
            </div>
          )}

          {!review && leadStatus === 'install_complete' && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-500">
                Installation is complete. Ready to request a review from the customer.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={handleRequestReview} loading={sending}>
                  <Send size={14} />
                  Request Review
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setQrModalOpen(true)}>
                  <QrCode size={14} />
                  QR Card
                </Button>
                {leadPhone && (
                  <Button size="sm" variant="secondary" onClick={handleSendViaSMS}>
                    <MessageSquare size={14} />
                    Send via Text
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={handleCopyLink}>
                  <Copy size={14} />
                  {linkCopied ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>
            </div>
          )}

          {review && review.status === 'pending' && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock size={16} className="text-amber-500" />
              Review request scheduled
            </div>
          )}

          {review && review.status === 'sent' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Send size={16} className="text-blue-500" />
                Review request sent on {review.sent_at ? formatDate(review.sent_at) : 'N/A'}
              </div>

              {daysAgo !== null && (
                <p className="text-xs text-slate-400">
                  Requested {daysAgo} {daysAgo === 1 ? 'day' : 'days'} ago
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {daysAgo !== null && daysAgo >= 3 && (
                  <Button size="sm" variant="secondary" onClick={handleResend} loading={sending}>
                    <RefreshCw size={14} />
                    Send Reminder
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setQrModalOpen(true)}>
                  <QrCode size={14} />
                  QR Card
                </Button>
                {leadPhone && (
                  <Button size="sm" variant="ghost" onClick={handleSendViaSMS}>
                    <MessageSquare size={14} />
                    Text Link
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={handleCopyLink}>
                  <Copy size={14} />
                  {linkCopied ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>

              <div className="mt-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium text-slate-500">QR Preview</p>
                <img
                  src={`https://chart.googleapis.com/chart?cht=qr&chs=100x100&chl=${encodeURIComponent(reviewUrl)}`}
                  alt="Review QR"
                  width={80}
                  height={80}
                  className="rounded"
                />
              </div>
            </div>
          )}

          {review && review.status === 'clicked' && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ExternalLink size={16} className="text-emerald-500" />
              Customer clicked the review link on{' '}
              {review.clicked_at ? formatDate(review.clicked_at) : 'N/A'}
            </div>
          )}

          {review && review.status === 'completed' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CheckCircle2 size={16} className="text-emerald-500" />
                <Star size={16} className="fill-amber-400 text-amber-400" />
                Review received!
              </div>
              <ReferralRequest
                leadId={leadId}
                leadName={leadName || 'Customer'}
                leadPhone={leadPhone}
                orgId={orgId ?? null}
              />
            </div>
          )}
        </div>
      </Card>

      <Modal open={qrModalOpen} onClose={() => setQrModalOpen(false)} title="Review QR Card">
        <ReviewQRCard leadName={leadName || 'Valued Customer'} reviewUrl={reviewUrl} />
      </Modal>
    </>
  );
}

export { ReviewSection };
