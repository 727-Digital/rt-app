import { supabase } from '@/lib/supabase';
import type { Quote, LineItem } from '@/lib/types';

export async function fetchQuotesForLead(leadId: string) {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Quote[];
}

export async function fetchQuote(id: string) {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, lead:leads(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Quote;
}

// Anonymous customer view of a quote. Whitelist the columns explicitly —
// the quotes row also stores internal margin data (materials_cost,
// labor_cost, overhead_cost, profit_split_percent) and we never want
// that visible to the customer, even in DevTools. The accompanying
// migration also revokes anon SELECT on those columns at the Postgres
// level as defense-in-depth.
export async function fetchPublicQuote(id: string) {
  const { data, error } = await supabase
    .from('quotes')
    .select(
      'id, lead_id, org_id, line_items, subtotal, total, status, valid_until, notes, warranty_text, sent_at, viewed_at, approved_at, rejected_at, expires_at, payment_status, payment_method, stripe_checkout_session_id, stripe_payment_intent_id, created_at, updated_at, lead:leads(id, name, email, phone, address), organization:organizations(id, name, email, phone, logo_url, primary_color, address)',
    )
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as unknown as Quote;
}

export async function createQuote(data: {
  org_id: string;
  lead_id: string;
  line_items: LineItem[];
  subtotal: number;
  total: number;
  warranty_text?: string;
  notes?: string;
  valid_until?: string;
  materials_cost?: number;
  labor_cost?: number;
  overhead_cost?: number;
  profit_split_percent?: number;
}) {
  const { data: quote, error } = await supabase
    .from('quotes')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return quote as Quote;
}

// No .select() after .update — we removed broad anon SELECT on quotes
// (column-level grants only expose customer-safe fields). When the public
// QuoteView calls this to set viewed_at / approved_at, RETURNING * would
// 401. Callers ignore the return value anyway.
export async function updateQuote(id: string, data: Partial<Quote>) {
  const { error } = await supabase
    .from('quotes')
    .update(data)
    .eq('id', id);

  if (error) throw error;
}
