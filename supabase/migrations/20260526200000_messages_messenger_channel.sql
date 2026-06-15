-- Allow channel='messenger' on the messages table. The original constraint
-- only permitted 'sms' and 'email'; adding 'messenger' for the FB DM
-- pipeline. Without this the receive-lead messenger handler silently
-- failed every message insert (channel check rejected the row) and only
-- the lead row got created, leaving threads empty in the UI.
--
-- 'canceled' is also added to the status enum so we can stop queued
-- outbound SMS without violating the existing constraint when the rep
-- closes a conversation mid-flight.

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_channel_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_channel_check
  CHECK (channel = ANY (ARRAY['sms'::text, 'email'::text, 'messenger'::text]));

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_status_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_status_check
  CHECK (status = ANY (ARRAY['queued'::text, 'sent'::text, 'delivered'::text, 'failed'::text, 'received'::text, 'canceled'::text]));
