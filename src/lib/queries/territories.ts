import { supabase } from '@/lib/supabase';
import type { Territory } from '@/lib/types';

export type TerritoryWithOrg = Territory & {
  organization: { name: string } | null;
};

export async function fetchTerritories(orgId?: string): Promise<TerritoryWithOrg[]> {
  let query = supabase
    .from('territories')
    .select('*, organization:organizations(name)')
    .order('name', { ascending: true });

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as TerritoryWithOrg[];
}

export async function createTerritory(
  territoryData: Omit<Territory, 'id' | 'created_at'>
): Promise<Territory> {
  const { data, error } = await supabase
    .from('territories')
    .insert(territoryData)
    .select()
    .single();

  if (error) throw error;
  return data as Territory;
}

export async function updateTerritory(
  id: string,
  updates: Partial<Omit<Territory, 'id' | 'created_at'>>
): Promise<Territory> {
  const { data, error } = await supabase
    .from('territories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Territory;
}

export async function deleteTerritory(id: string): Promise<void> {
  const { error } = await supabase
    .from('territories')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function findTerritoryByZip(zipCode: string): Promise<TerritoryWithOrg | null> {
  const { data, error } = await supabase
    .from('territories')
    .select('*, organization:organizations(name)')
    .contains('zip_codes', [zipCode])
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as TerritoryWithOrg | null;
}
