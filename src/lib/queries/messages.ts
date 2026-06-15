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
  // Channel is a property of the lead, not the form: leads with fb_psid
  // are Messenger threads, everyone else is SMS. The composer in
  // LeadDetail resolves this and passes it in. Defaults to 'sms' for
  // backward compat with anywhere that hasn't been updated yet.
  channel?: 'sms' | 'messenger';
}) {
  const channel = data.channel ?? 'sms';

  // Auto-claim: pass the current authenticated user.id so send-sms can
  // assign this lead to whoever's texting if no one owns it yet. The first
  // rep to text the customer becomes the lead's owner, and their Signal
  // House number sends from this point forward.
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;

  // Insert the outbound row FIRST so the edge function can update it
  // with the provider message id. Messenger and SMS both go through
  // send-sms; the edge function detects channel by looking at the
  // lead's fb_psid, so the request shape stays identical.
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      lead_id: data.lead_id,
      org_id: data.org_id,
      direction: 'outbound',
      channel,
      to_number: data.to_number,
      body: data.body,
      status: 'queued',
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.functions.invoke('send-sms', {
    body: {
      lead_id: data.lead_id,
      org_id: data.org_id,
      to_number: data.to_number,
      body: data.body,
      auto_claim_user_id: userId ?? null,
    },
  });

  return message as Message;
}
