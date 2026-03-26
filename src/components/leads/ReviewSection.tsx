import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock, ExternalLink, RefreshCw, Send, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { fetchReviewsForLead } from '@/lib/queries/reviews';
import { supabase } from '@/lib/supabase';
import type { LeadStatus, Review } from '@/lib/types';
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
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function ReviewSection({ leadId, leadStatus }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');

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

  return (
    <Card className="mt-4">
      <h3 className="text-sm font-semibold text-slate-900">Reviews</h3>

      {message && (
        <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}

      <div className="mt-3">
        {!review && leadStatus === 'install_complete' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              Installation is complete. Ready to request a review from the customer.
            </p>
            <Button size="sm" onClick={handleRequestReview} loading={sending}>
              <Send size={14} />
              Request Review
            </Button>
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
            {review.sent_at && daysSince(review.sent_at) > 3 && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleResend}
                loading={sending}
              >
                <RefreshCw size={14} />
                Resend Review Request
              </Button>
            )}
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
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CheckCircle2 size={16} className="text-emerald-500" />
            <Star size={16} className="fill-amber-400 text-amber-400" />
            Review received!
          </div>
        )}
      </div>
    </Card>
  );
}

export { ReviewSection };
