-- SECURITY HARDENING (audit H1): pin search_path on SECURITY DEFINER
-- functions that are invoked by RLS policies and triggers.
--
-- A SECURITY DEFINER function without a pinned search_path runs with the
-- caller-controlled search_path. An attacker who can create objects in a
-- schema earlier on the resolved path can shadow `team_members`,
-- `organizations`, etc., causing these definer-context functions to read
-- attacker-controlled data and return the wrong answer to RLS — an auth
-- bypass / privilege-escalation vector.
--
-- is_platform_admin(), get_public_quote(), delete_lead_cascade() were
-- already pinned. These four were not:

ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.get_user_org_id() SET search_path = public;
ALTER FUNCTION public.delete_own_account() SET search_path = public;
ALTER FUNCTION public.update_lead_first_response() SET search_path = public;
