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

export async function fetchPublicQuote(id: string) {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, lead:leads(*)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Quote;
}

export async function createQuote(data: {
  lead_id: string;
  line_items: LineItem[];
  subtotal: number;
  total: number;
  warranty_text?: string;
  notes?: string;
  valid_until?: string;
}) {
  const { data: quote, error } = await supabase
    .from('quotes')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return quote as Quote;
}

export async function updateQuote(id: string, data: Partial<Quote>) {
  const { data: quote, error } = await supabase
    .from('quotes')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return quote as Quote;
}
