import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Clock, CreditCard, ExternalLink, Landmark, MessageSquare } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { QuotePreview } from '@/components/quotes/QuotePreview';
import { fetchPublicQuote, updateQuote } from '@/lib/queries/quotes';
import { cancelPendingFollowUpsForQuote } from '@/lib/queries/follow_ups';
import { supabase } from '@/lib/supabase';
import type { Quote } from '@/lib/types';
import { cn, formatCurrency } from '@/lib/utils';

function ExpirationCountdown({ quote, primaryColor }: { quote: Quote; primaryColor: string }) {
  const expiresAt = quote.expires_at || quote.valid_until;
  if (!expiresAt) return null;

  const now = new Date();
  const expiry = parseISO(expiresAt);
  const daysLeft = differenceInDays(expiry, now);
  const isExpired = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft < 3;

  const totalDays = quote.sent_at
    ? differenceInDays(expiry, parseISO(quote.sent_at))
    : 14;
  const progress = isExpired ? 100 : Math.max(0, Math.min(100, ((totalDays - daysLeft) / totalDays) * 100));

  if (isExpired) {
    return (
      <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-red-700">
          <Clock size={18} />
          <p className="font-semibold">This quote has expired.</p>
        </div>
        <p className="mt-1 text-sm text-red-600">Contact us for an updated quote.</p>
      </div>
    );
  }

  return (
    <div className={cn(
      'mb-6 rounded-xl border p-4',
      isUrgent ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white',
    )}>
      <div className={cn(
        'flex items-center justify-center gap-2 text-sm font-medium',
        isUrgent ? 'text-amber-700' : 'text-slate-700',
      )}>
        <Clock size={16} />
        This quote expires in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progress}%`,
            backgroundColor: isUrgent ? '#d97706' : primaryColor,
          }}
        />
      </div>
    </div>
  );
}

function FinancingSection({ total, primaryColor }: { total: number; primaryColor: string }) {
  const monthly12 = total / 12;
  const monthly24 = total / 24;
  const monthly60 = total / 60;

  return (
    <div className="mb-6 rounded-xl border-2 p-4" style={{
      borderImage: 'linear-gradient(135deg, #3b82f6, #8b5cf6) 1',
    }}>
      <h3 className="text-center text-lg font-semibold text-slate-900">
        Monthly Payment Options
      </h3>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {[
          { months: 12, amount: monthly12 },
          { months: 24, amount: monthly24 },
          { months: 60, amount: monthly60 },
        ].map((opt) => (
          <div
            key={opt.months}
            className="flex flex-col items-center rounded-lg border border-slate-200 bg-white p-3"
          >
            <p className="text-xl font-bold text-slate-900">
              {formatCurrency(opt.amount)}
            </p>
            <p className="text-xs text-slate-500">/month</p>
            <p className="mt-1 text-xs font-medium text-slate-600">
              {opt.months} months
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <a
          href="https://wisetack.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: primaryColor }}
        >
          <ExternalLink size={16} />
          Apply for Financing
        </a>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">
        Quick application, no impact on your credit score. Powered by Wisetack.
      </p>
    </div>
  );
}

function formatPaymentMethods(methods?: string[]): string {
  if (!methods || methods.length === 0) return 'check or Zelle';
  return methods.join(', ');
}

export default function QuoteView() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const [searchParams] = useSearchParams();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approved, setApproved] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showChangesMsg, setShowChangesMsg] = useState(false);
  const [creatingCheckout, setCreatingCheckout] = useState<'card' | 'ach' | null>(null);

  const paymentSuccess = searchParams.get('payment') === 'success';

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
      await cancelPendingFollowUpsForQuote(quoteId).catch(() => {});
      setApproved(true);
    } finally {
      setApproving(false);
    }
  }

  async function handleCheckout(paymentType: 'card' | 'ach') {
    if (!quoteId) return;
    setCreatingCheckout(paymentType);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
        body: { quote_id: quoteId, payment_type: paymentType },
      });
      if (fnError) throw fnError;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch {
      setError('Failed to create payment session. Please try again.');
    } finally {
      setCreatingCheckout(null);
    }
  }

  const org = quote?.organization;
  const isWhiteLabel = !!org?.logo_url;
  const orgName = org?.name || 'TurfFlow';
  const primaryColor = org?.primary_color || '#059669';
  const contactPhone = org?.phone || '';
  const contactEmail = org?.email || '';

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
          <h1 className="text-xl font-bold" style={{ color: primaryColor }}>
            {orgName}
          </h1>
          <p className="mt-4 text-slate-500">{error ?? 'Quote not found.'}</p>
        </div>
      </div>
    );
  }

  const branding = {
    name: orgName,
    logo_url: org?.logo_url,
    primary_color: primaryColor,
  };

  return (
    <>
      <title>Your Turf Quote — {orgName}</title>
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 text-center">
            {org?.logo_url ? (
              <img
                src={org.logo_url}
                alt={orgName}
                className="mx-auto h-12 object-contain"
              />
            ) : (
              <h1
                className="text-2xl font-bold"
                style={{ color: primaryColor }}
              >
                {orgName}
              </h1>
            )}
          </div>

          {paymentSuccess && (
            <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 size={32} className="text-emerald-600" />
              <p className="text-lg font-semibold text-emerald-700">
                Payment Successful!
              </p>
              <p className="text-sm text-emerald-600">
                Thank you for your payment. We'll be in touch shortly.
              </p>
            </div>
          )}

          {quote.payment_status === 'paid' && !paymentSuccess && (
            <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <CheckCircle2 size={32} className="text-emerald-600" />
              <p className="text-lg font-semibold text-emerald-700">
                Payment Received
              </p>
              <p className="text-sm text-emerald-600">
                Your payment has been processed. We'll be in touch to schedule your installation.
              </p>
            </div>
          )}

          {quote.payment_status === 'partial' && (
            <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
              <AlertCircle size={32} className="text-amber-600" />
              <p className="text-lg font-semibold text-amber-700">
                Partial Payment Received
              </p>
              <p className="text-sm text-amber-600">
                A partial payment has been applied to this quote. Remaining balance due.
              </p>
            </div>
          )}

          {quote.payment_status === 'refunded' && (
            <div className="mb-6 flex flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <AlertCircle size={32} className="text-red-600" />
              <p className="text-lg font-semibold text-red-700">
                Payment Refunded
              </p>
              <p className="text-sm text-red-600">
                The payment for this quote has been refunded.
              </p>
            </div>
          )}

          {approved && quote.payment_status !== 'paid' && quote.payment_status !== 'refunded' ? (
            <div className="mb-6">
              <div
                className="mb-4 flex flex-col items-center gap-2 rounded-xl border p-6 text-center"
                style={{
                  borderColor: `${primaryColor}33`,
                  backgroundColor: `${primaryColor}0d`,
                }}
              >
                <CheckCircle2 size={32} style={{ color: primaryColor }} />
                <p className="text-lg font-semibold" style={{ color: primaryColor }}>
                  Quote Approved!
                </p>
                <p className="text-sm" style={{ color: `${primaryColor}cc` }}>
                  Complete your payment below to get started.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  size="lg"
                  onClick={() => handleCheckout('card')}
                  loading={creatingCheckout === 'card'}
                  disabled={creatingCheckout !== null}
                  className="flex-1"
                  style={{ backgroundColor: primaryColor }}
                >
                  <CreditCard size={18} />
                  Pay with Card
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => handleCheckout('ach')}
                  loading={creatingCheckout === 'ach'}
                  disabled={creatingCheckout !== null}
                  className="flex-1"
                >
                  <Landmark size={18} />
                  Pay with Bank Transfer (ACH)
                </Button>
              </div>
              <p className="mt-3 text-center text-xs text-slate-400">
                We also accept Check or Zelle
              </p>
            </div>
          ) : !approved ? (
            <div className="mb-6 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={handleApprove}
                loading={approving}
                className="flex-1"
                style={{ backgroundColor: primaryColor }}
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
          ) : null}

          {showChangesMsg && !approved && (
            <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-center text-sm text-slate-600">
              Please contact us at{' '}
              <span className="font-medium text-slate-900">{contactPhone}</span>
              {contactEmail && (
                <>
                  {' '}or{' '}
                  <a
                    href={`mailto:${contactEmail}`}
                    className="font-medium underline"
                    style={{ color: primaryColor }}
                  >
                    {contactEmail}
                  </a>
                </>
              )}{' '}
              to discuss any changes to your quote.
            </div>
          )}

          <ExpirationCountdown quote={quote} primaryColor={primaryColor} />

          {!approved && quote.payment_status !== 'paid' && (
            <FinancingSection total={quote.total} primaryColor={primaryColor} />
          )}

          <QuotePreview
            quote={quote}
            lead={quote.lead!}
            quoteNumber={quote.id.slice(0, 8).toUpperCase()}
            branding={branding}
            organization={isWhiteLabel ? org : null}
          />

          {quote.payment_status !== 'paid' && (
            <p className="mt-8 text-center text-xs text-slate-400">
              Payment accepted via {formatPaymentMethods(org?.payment_methods)}.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
