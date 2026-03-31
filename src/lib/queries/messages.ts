import { supabase } from '@/lib/supabase';
import type { Message } from '@/lib/types';

export async function fetchMessages(leadId: string) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as Message[];
}

export async function sendMessage(data: {
  lead_id: string;
  org_id: string | null;
  to_number: string;
  body: string;
}) {
  await supabase.functions.invoke('send-sms', { body: data });

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      lead_id: data.lead_id,
      org_id: data.org_id,
      direction: 'outbound',
      channel: 'sms',
      to_number: data.to_number,
      body: data.body,
      status: 'queued',
    })
    .select()
    .single();

  if (error) throw error;
  return message as Message;
}
