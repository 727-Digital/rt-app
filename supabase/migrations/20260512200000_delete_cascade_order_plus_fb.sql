-- Two fixes to delete_lead_cascade discovered by running it against real
-- seed leads:
--   1. fb_conversion_events also has a lead_id FK — was missing entirely.
--   2. follow_ups and notifications both reference quote_id as well as
--      lead_id, so they have to be deleted BEFORE quotes (otherwise
--      DELETE FROM quotes fails with a FK violation from the quote_id
--      row still in follow_ups / notifications).
--
-- This replaces the function in place. Same signature, same anon-revoked
-- grant.

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
  v_fb_events int;
  v_leads int;
BEGIN
  -- Kill everything that references quotes.id FIRST, then quotes themselves.
  -- follow_ups and notifications both carry quote_id, so they must go before
  -- quotes — even though they also reference lead_id directly.

  WITH d AS (
    DELETE FROM public.follow_ups WHERE lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_follow_ups FROM d;

  WITH d AS (
    DELETE FROM public.notifications WHERE lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_notifications FROM d;

  WITH d AS (
    DELETE FROM public.quote_views
    WHERE quote_id IN (SELECT id FROM public.quotes WHERE lead_id = lead_uuid)
    RETURNING 1
  ) SELECT count(*) INTO v_quote_views FROM d;

  WITH d AS (
    DELETE FROM public.quotes WHERE lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_quotes FROM d;

  -- Now everything else that references lead_id but not quote_id.

  WITH d AS (
    DELETE FROM public.messages WHERE lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_messages FROM d;

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

  -- fb_conversion_events was missing entirely from the prior cascade.
  WITH d AS (
    DELETE FROM public.fb_conversion_events WHERE lead_id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_fb_events FROM d;

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
    'referrals', v_referrals,
    'fb_conversion_events', v_fb_events
  );

  RETURN result;
END;
$$;
