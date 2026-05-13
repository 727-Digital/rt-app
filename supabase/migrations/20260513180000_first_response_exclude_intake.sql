-- The previous trigger counted the auto-intake confirmation SMS ("Hi {name},
-- thanks for your turf request! A team member will be in touch shortly...")
-- as the rep's first response. That message fires automatically from
-- receive-lead within ~1 second of a form submission, so every lead shows
-- "first response: 1s" — meaningless as an SLA metric.
--
-- The intake SMS is the SYSTEM's response, not the rep's. A real rep
-- response is the first manual message OR the first appointment
-- confirmation OR any other outbound that isn't the boilerplate intake.
--
-- Fix: exclude outbound messages whose body matches the intake template
-- from both the trigger and the backfill. Re-running the backfill resets
-- first_response_at for any lead whose only "response" was the intake.

CREATE OR REPLACE FUNCTION public.update_lead_first_response()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.direction = 'outbound'
     AND NEW.lead_id IS NOT NULL
     -- Skip the auto-intake confirmation. Matches the body template
     -- generated in receive-lead/sendCustomerIntakeSms.
     AND NEW.body NOT ILIKE 'Hi %thanks for your turf request%'
  THEN
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

-- Wipe any backfilled values that came from intake-only matches, then
-- re-backfill from the first NON-intake outbound message per lead.
UPDATE public.leads SET first_response_at = NULL, response_time_seconds = NULL
WHERE id IN (
  SELECT l.id FROM public.leads l
  JOIN public.messages m
    ON m.lead_id = l.id
   AND m.direction = 'outbound'
   AND m.created_at = l.first_response_at
   AND m.body ILIKE 'Hi %thanks for your turf request%'
);

WITH first_real_outbound AS (
  SELECT
    lead_id,
    MIN(created_at) AS sent_at
  FROM public.messages
  WHERE direction = 'outbound'
    AND lead_id IS NOT NULL
    AND body NOT ILIKE 'Hi %thanks for your turf request%'
  GROUP BY lead_id
)
UPDATE public.leads l
SET
  first_response_at = fr.sent_at,
  response_time_seconds = GREATEST(0, EXTRACT(EPOCH FROM (fr.sent_at - l.created_at))::int)
FROM first_real_outbound fr
WHERE l.id = fr.lead_id
  AND l.first_response_at IS NULL;
