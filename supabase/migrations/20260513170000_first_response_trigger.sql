-- "First response" SLA tracking previously only updated lead.first_response_at
-- when a rep typed a message via the MessageThread UI. Automated outbound
-- messages (intake confirmation, appointment confirmation, quote send, etc.)
-- bypassed that update path, so leads showed "No response yet" even when
-- the customer had already received multiple outbound texts.
--
-- Fix: DB trigger fires on every outbound message insert, sets the lead's
-- first_response_at + response_time_seconds if they're still null. Catches
-- every outbound code path automatically — no more "did I remember to
-- update first_response_at in this caller?" land mines.

CREATE OR REPLACE FUNCTION public.update_lead_first_response()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.direction = 'outbound' AND NEW.lead_id IS NOT NULL THEN
    UPDATE public.leads l
    SET
      first_response_at = COALESCE(l.first_response_at, NEW.created_at),
      response_time_seconds = COALESCE(
        l.response_time_seconds,
        GREATEST(0, EXTRACT(EPOCH FROM (NEW.created_at - l.created_at))::int)
      )
    WHERE l.id = NEW.lead_id
      AND l.first_response_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS messages_set_first_response ON public.messages;
CREATE TRIGGER messages_set_first_response
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_first_response();

-- Backfill leads that already have outbound messages but no first_response_at.
-- Uses the earliest outbound message per lead to stamp the timestamp + delta.
WITH first_outbound AS (
  SELECT
    lead_id,
    MIN(created_at) AS sent_at
  FROM public.messages
  WHERE direction = 'outbound' AND lead_id IS NOT NULL
  GROUP BY lead_id
)
UPDATE public.leads l
SET
  first_response_at = fo.sent_at,
  response_time_seconds = GREATEST(0, EXTRACT(EPOCH FROM (fo.sent_at - l.created_at))::int)
FROM first_outbound fo
WHERE l.id = fo.lead_id
  AND l.first_response_at IS NULL;
