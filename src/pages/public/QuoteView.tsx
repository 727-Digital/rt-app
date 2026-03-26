import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { QuotePreview } from '@/components/quotes/QuotePreview';
import { fetchPublicQuote, updateQuote } from '@/lib/queries/quotes';
import { supabase } from '@/lib/supabase';
import type { Quote } from '@/lib/types';

export default function QuoteView() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showChangesMsg, setShowChangesMsg] = useState(false);

  useEffect(() => {
    if (!quoteId) return;

    async function load() {
      try {
        const data = await fetchPublicQuote(quoteId!);
        setQuote(data);
        if (data.status === 'approved') setApproved(true);
      } catch {
        setError('Quote not found.');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [quoteId]);

  useEffect(() => {
    if (!quoteId || loading || error) return;

    supabase.from('quote_views').insert({
      quote_id: quoteId,
      viewed_at: new Date().toISOString(),
    });

    if (quote && quote.status === 'sent') {
      updateQuote(quoteId, {
        status: 'viewed',
        viewed_at: new Date().toISOString(),
      });
    }
  }, [quoteId, loading, error, quote]);

  async function handleApprove() {
    if (!quoteId || !quote?.lead_id) return;
    setApproving(true);
    try {
      await updateQuote(quoteId, {
        status: 'approved',
        approved_at: new Date().toISOString(),
      });
      await supabase
        .from('leads')
        .update({ status: 'quote_approved' })
        .eq('id', quote.lead_id);
      setApproved(true);
    } finally {
      setApproving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size={32} />
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-emerald-700">Reliable Turf</h1>
          <p className="mt-4 text-slate-500">{error ?? 'Quote not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <title>Your Turf Quote — Reliable Turf</title>
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-6 text-center text-2xl font-bold text-emerald-700">
            Reliable Turf
          </h1>

          {approved ? (
            <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 size={32} className="text-emerald-600" />
              <p className="text-lg font-semibold text-emerald-800">
                Quote Approved!
              </p>
              <p className="text-sm text-emerald-600">
                We'll be in touch to schedule your installation.
              </p>
            </div>
          ) : (
            <div className="mb-6 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={handleApprove}
                loading={approving}
                className="flex-1"
              >
                <CheckCircle2 size={18} />
                Approve Quote
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setShowChangesMsg(true)}
                className="flex-1"
              >
                <MessageSquare size={18} />
                Request Changes
              </Button>
            </div>
          )}

          {showChangesMsg && !approved && (
            <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-600">
              Please contact us at{' '}
              <span className="font-medium text-slate-900">(850) 565-7099</span>{' '}
              to discuss any changes to your quote.
            </div>
          )}

          <QuotePreview
            quote={quote}
            lead={quote.lead!}
            quoteNumber={quote.id.slice(0, 8).toUpperCase()}
          />

          <p className="mt-8 text-center text-xs text-slate-400">
            Payment accepted via check or Zelle.
          </p>
        </div>
      </div>
    </>
  );
}
