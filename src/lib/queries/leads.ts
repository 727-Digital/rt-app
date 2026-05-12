import { supabase } from '@/lib/supabase';
import type { Lead, LeadStatus } from '@/lib/types';

// ---------------------------------------------------------------------------
// Lead cache (localStorage). Lets LeadDetail render instantly on cold-start
// push-tap for any lead the rep has opened before. TTL prevents leftover
// rows from filling localStorage forever.
// ---------------------------------------------------------------------------

const LEAD_CACHE_PREFIX = 'rt-lead-cache-v1:';
const LEAD_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 1 day

export function readCachedLead(id: string): Lead | null {
  try {
    const raw = localStorage.getItem(LEAD_CACHE_PREFIX + id);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { lead?: Lead; ts?: number };
    if (!parsed.lead || !parsed.ts) return null;
    if (Date.now() - parsed.ts > LEAD_CACHE_TTL_MS) {
      localStorage.removeItem(LEAD_CACHE_PREFIX + id);
      return null;
    }
    return parsed.lead;
  } catch {
    return null;
  }
}

function writeCachedLead(lead: Lead) {
  try {
    localStorage.setItem(
      LEAD_CACHE_PREFIX + lead.id,
      JSON.stringify({ lead, ts: Date.now() }),
    );
  } catch {
    // localStorage might be full or unavailable; ignore.
  }
}

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
  writeCachedLead(data as Lead);
  return data as Lead;
}

export async function createLead(
  data: Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'status' | 'organization' | 'first_response_at' | 'response_time_seconds' | 'loss_reason' | 'loss_notes' | 'referral_source'>
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
  writeCachedLead(lead as Lead);
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
  writeCachedLead(lead as Lead);
  return lead as Lead;
}
