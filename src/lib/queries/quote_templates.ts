import { supabase } from '@/lib/supabase';
import type { QuoteTemplate } from '@/lib/types';

export async function fetchQuoteTemplates(orgId: string) {
  const { data, error } = await supabase
    .from('quote_templates')
    .select('*')
    .eq('org_id', orgId)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as QuoteTemplate[];
}

export async function createQuoteTemplate(template: Omit<QuoteTemplate, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('quote_templates')
    .insert(template)
    .select()
    .single();

  if (error) throw error;
  return data as QuoteTemplate;
}

export async function updateQuoteTemplate(
  id: string,
  updates: Partial<Omit<QuoteTemplate, 'id' | 'org_id' | 'created_at'>>,
) {
  const { error } = await supabase
    .from('quote_templates')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteQuoteTemplate(id: string) {
  const { error } = await supabase
    .from('quote_templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
