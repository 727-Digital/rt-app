import { supabase } from '@/lib/supabase';

export type FollowUp = {
  id: string;
  lead_id: string;
  quote_id: string | null;
  org_id: string | null;
  type: string;
  scheduled_for: string;
  sent_at: string | null;
  channel: string | null;
  body: string | null;
  status: 'pending' | 'sent' | 'cancelled';
  created_at: string;
};

export async function createFollowUp(data: {
  lead_id: string;
  quote_id?: string | null;
  org_id?: string | null;
  type: string;
  scheduled_for: string;
  channel?: string | null;
  body?: string | null;
}) {
  const { data: followUp, error } = await supabase
    .from('follow_ups')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return followUp as FollowUp;
}

export async function fetchFollowUps(leadId?: string) {
  let query = supabase
    .from('follow_ups')
    .select('*')
    .order('scheduled_for', { ascending: true });

  if (leadId) {
    query = query.eq('lead_id', leadId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as FollowUp[];
}

export async function cancelFollowUp(id: string) {
  const { data, error } = await supabase
    .from('follow_ups')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as FollowUp;
}

export async function cancelPendingFollowUpsForQuote(quoteId: string) {
  const { error } = await supabase
    .from('follow_ups')
    .update({ status: 'cancelled' })
    .eq('quote_id', quoteId)
    .eq('status', 'pending');

  if (error) throw error;
}
