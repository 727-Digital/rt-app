import { supabase } from '@/lib/supabase';
import type { Organization } from '@/lib/types';

export async function fetchOrganization(id: string): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Organization;
}

export async function updateOrganization(
  id: string,
  updates: Partial<Organization>
): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Organization;
}

export async function fetchAllOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return data as Organization[];
}

export async function createOrganization(
  orgData: Omit<Organization, 'id' | 'created_at' | 'updated_at'>
): Promise<Organization> {
  const { data, error } = await supabase
    .from('organizations')
    .insert(orgData)
    .select()
    .single();

  if (error) throw error;
  return data as Organization;
}
