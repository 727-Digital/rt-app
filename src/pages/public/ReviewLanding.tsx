import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink, Star } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import type { Organization } from '@/lib/types';

export default function ReviewLanding() {
  const { leadId } = useParams<{ leadId: string }>();
  const [leadName, setLeadName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);

  useEffect(() => {
    if (!leadId) return;

    async function load() {
      try {
        const { data: lead, error: leadErr } = await supabase
          .from('leads')
          .select('name, org_id')
          .eq('id', leadId!)
          .single();

        if (leadErr || !lead) {
          setError(true);
          return;
        }

        setLeadName(lead.name);

        if (lead.org_id) {
          const { data: orgData } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', lead.org_id)
            .single();
          if (orgData) setOrg(orgData as Organization);
        }

        const { data: review } = await supabase
          .from('reviews')
          .select('review_url')
          .eq('lead_id', leadId!)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        setGoogleUrl(review?.review_url ?? null);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [leadId]);

  const orgName = org?.name || 'TurfFlow';
  const primaryColor = org?.primary_color || '#059669';
  const reviewDestination = org?.google_review_url || googleUrl || '';

  async function handleClick() {
    if (!leadId) return;

    await supabase
      .from('reviews')
      .update({ status: 'clicked', clicked_at: new Date().toISOString() })
      .eq('lead_id', leadId)
      .eq('status', 'sent');

    window.open(reviewDestination, '_blank', 'noopener');
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Spinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">Page Not Found</h1>
          <p className="mt-2 text-slate-500">This review link may have expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {org?.logo_url ? (
          <img
            src={org.logo_url}
            alt={orgName}
            className="mx-auto h-12 object-contain"
          />
        ) : (
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: primaryColor }}
          >
            {orgName}
          </h1>
        )}
        <div
          className="mx-auto mt-2 h-0.5 w-12 rounded-full"
          style={{ backgroundColor: `${primaryColor}66` }}
        />

        <div className="mt-8">
          <p className="text-3xl font-semibold text-slate-900">
            Thank you{leadName ? `, ${leadName}` : ''}!
          </p>
          <p className="mt-3 text-slate-500">
            We appreciate your business! Click below to share your experience.
          </p>
        </div>

        <button
          onClick={handleClick}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: primaryColor }}
        >
          Leave a Review on Google
          <Star size={20} className="fill-white" />
          <ExternalLink size={18} />
        </button>

        <p className="mt-6 text-sm text-slate-400">
          Your feedback helps other homeowners find quality turf installation
        </p>

        <div className="mt-8 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-300">
            {orgName}
          </p>
        </div>
      </div>
    </div>
  );
}
