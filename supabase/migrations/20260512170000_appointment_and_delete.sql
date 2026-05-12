-- Two unrelated additions bundled to keep migrations tidy:
--
-- 1. Extend the notification_type enum to cover appointment scheduling.
--    Today the team gets nothing when a site visit or install is booked.
--    These new types let send-notification log + fire SMS/email/push.
--
-- 2. Add delete_lead_cascade(uuid) — a SECURITY DEFINER function that
--    removes a lead and every row that references it in a single
--    transaction. The cross-table cleanup is too fiddly for the client
--    to coordinate over multiple network calls, and FK CASCADE isn't
--    set on these relationships. Authenticated team members can call it
--    via supabase.rpc('delete_lead_cascade', {...}).

-- ---------------------------------------------------------------------------
-- 1. New notification types
-- ---------------------------------------------------------------------------

-- ALTER TYPE ADD VALUE is idempotent only if the value isn't already there;
-- wrap in a DO block so re-running the migration doesn't error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.notification_type'::regtype
      AND enumlabel = 'site_visit_scheduled'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'site_visit_scheduled';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.notification_type'::regtype
      AND enumlabel = 'install_scheduled'
  ) THEN
    ALTER TYPE public.notification_type ADD VALUE 'install_scheduled';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. delete_lead_cascade
-- ---------------------------------------------------------------------------

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
  v_leads int;
BEGIN
  -- quote_views references quotes(id), so kill it first using the lead's quotes.
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
    DELETE FROM public.leads WHERE id = lead_uuid RETURNING 1
  ) SELECT count(*) INTO v_leads FROM d;

  result := json_build_object(
    'lead_deleted', v_leads > 0,
    'quotes', v_quotes,
    'quote_views', v_quote_views,
    'messages', v_messages,
    'follow_ups', v_follow_ups,
    'notifications', v_notifications,
    'appointments', v_appointments
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_lead_cascade(uuid) TO authenticated;
