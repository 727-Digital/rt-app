import { supabase } from '@/lib/supabase';
import type { Review } from '@/lib/types';

export async function fetchReviewsForLead(leadId: string) {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Review[];
}

export async function requestReview(leadId: string) {
  const { data, error } = await supabase.functions.invoke('request-review', {
    body: { lead_id: leadId },
  });

  if (error) throw error;
  return data;
}
