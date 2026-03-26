import { supabase } from '@/lib/supabase';
import type { Lead, LeadStatus } from '@/lib/types';

export async function fetchLeads() {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Lead[];
}

export async function fetchLeadsWithOrg() {
  const { data, error } = await supabase
    .from('leads')
    .select('*, organization:organizations(name, slug)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Lead[];
}

export async function fetchLead(id: string) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Lead;
}

export async function createLead(
  data: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'status' | 'organization'>
) {
  const { data: lead, error } = await supabase
    .from('leads')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return lead as Lead;
}

export async function updateLead(id: string, data: Partial<Lead>) {
  const { data: lead, error } = await supabase
    .from('leads')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return lead as Lead;
}

export async function updateLeadStatus(id: string, status: LeadStatus) {
  const { data: lead, error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return lead as Lead;
}
