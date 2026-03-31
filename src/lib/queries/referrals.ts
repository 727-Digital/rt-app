import { supabase } from '@/lib/supabase';

export type Referral = {
  id: string;
  referrer_lead_id: string;
  referred_name: string | null;
  referred_email: string | null;
  referred_phone: string | null;
  referred_address: string | null;
  status: string;
  reward_amount: number | null;
  org_id: string | null;
  created_at: string;
};

export async function createReferral(data: {
  referrer_lead_id: string;
  referred_name?: string | null;
  referred_email?: string | null;
  referred_phone?: string | null;
  referred_address?: string | null;
  reward_amount?: number | null;
  org_id?: string | null;
}) {
  const { data: referral, error } = await supabase
    .from('referrals')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return referral as Referral;
}

export async function fetchReferrals(orgId?: string) {
  let query = supabase
    .from('referrals')
    .select('*, referrer:leads!referrer_lead_id(name, email, phone)')
    .order('created_at', { ascending: false });

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as (Referral & { referrer?: { name: string; email: string; phone: string } })[];
}
