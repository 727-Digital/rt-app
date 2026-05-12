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

// Anonymous customer view of a quote. Calls the SECURITY DEFINER function
// get_public_quote(uuid) instead of SELECTing the table directly. Two reasons:
//   1. anon doesn't have RLS read access to the leads table, so a naive
//      lead:leads(...) embed returns null and the renderer crashes on lead.name.
//   2. The function returns a fixed, customer-safe shape — no margin data
//      (materials_cost / labor_cost / overhead / profit_split), no internal
//      lead notes / status / loss reasons.
// Authenticated admin paths still use fetchQuote / fetchQuotesForLead which
// hit the table directly under the authenticated role.
export async function fetchPublicQuote(id: string) {
  const { data, error } = await supabase.rpc('get_public_quote', {
    quote_uuid: id,
  });

  if (error) throw error;
  if (!data) throw new Error('Quote not found');
  return data as Quote;
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
