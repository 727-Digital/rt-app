import { supabase } from '@/lib/supabase';
import type { Appointment } from '@/lib/types';

export async function fetchAppointments(filters?: {
  orgId?: string;
  teamMemberId?: string;
  startDate?: string;
  endDate?: string;
}) {
  let query = supabase
    .from('appointments')
    .select('*, lead:leads(id, name, address, phone)')
    .order('start_time', { ascending: true });

  if (filters?.orgId) {
    query = query.eq('org_id', filters.orgId);
  }
  if (filters?.teamMemberId) {
    query = query.eq('team_member_id', filters.teamMemberId);
  }
  if (filters?.startDate) {
    query = query.gte('start_time', filters.startDate);
  }
  if (filters?.endDate) {
    query = query.lte('start_time', filters.endDate);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Appointment[];
}

export async function createAppointment(data: {
  lead_id: string;
  org_id: string | null;
  title: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
}) {
  const { data: appointment, error } = await supabase
    .from('appointments')
    .insert(data)
    .select()
    .single();

  if (error) throw error;
  return appointment as Appointment;
}

export async function updateAppointment(id: string, data: Partial<Appointment>) {
  const { data: appointment, error } = await supabase
    .from('appointments')
    .update(data)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return appointment as Appointment;
}

export async function deleteAppointment(id: string) {
  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
