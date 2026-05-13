-- delete_lead_cascade was missing three tables that also reference leads.id:
--   - reviews          (lead_id)
--   - photos           (lead_id)
--   - referrals        (referrer_lead_id)
-- Without these in the cascade, attempting to delete a lead that has any
-- review request, photo, or referral row fails with a foreign-key violation.
-- This replaces the function (same signature) to clean those tables too.
--
-- Storage objects backing the `photos` table are NOT deleted here — they
-- live in Supabase Storage, not Postgres. Removing the row leaves an
-- orphan file in the bucket; that's a low-priority follow-up.

CREATE OR REPLACE FUNCTION public.delete_lead_cascade(lead_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  v_quotes int;
  v_quote_views int;
  v_messages int;
  v_follow_ups int;
  v_notifications int;
  v_appointments int;
  v_reviews int;
  v_photos int;
  v_referrals int;
  v_leads int;
BEGIN
  WITH d AS (
    DELETE FROM public.quote_views
    WHERE quote_id IN (SELECT id FROM public.quotes WHERE lead_id = lead_uuid)
    RETURNING 1
  ) SELECT count(*) INTO v_quote_views FROM d;

  WITH d AS (
    DELETE FROM public.quotes WHERE lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_quotes FROM d;

  WITH d AS (
    DELETE FROM public.messages WHERE lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_messages FROM d;

  WITH d AS (
    DELETE FROM public.follow_ups WHERE lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_follow_ups FROM d;

  WITH d AS (
    DELETE FROM public.notifications WHERE lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_notifications FROM d;

  WITH d AS (
    DELETE FROM public.appointments WHERE lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_appointments FROM d;

  WITH d AS (
    DELETE FROM public.reviews WHERE lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_reviews FROM d;

  WITH d AS (
    DELETE FROM public.photos WHERE lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_photos FROM d;

  WITH d AS (
    DELETE FROM public.referrals WHERE referrer_lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_referrals FROM d;

  WITH d AS (
    DELETE FROM public.leads WHERE id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_leads FROM d;

  result := json_build_object(
    'lead_deleted', v_leads > 0,
    'quotes', v_quotes,
    'quote_views', v_quote_views,
    'messages', v_messages,
    'follow_ups', v_follow_ups,
    'notifications', v_notifications,
    'appointments', v_appointments,
    'reviews', v_reviews,
    'photos', v_photos,
    'referrals', v_referrals
  );

  RETURN result;
END;
$$;
