-- SECURITY FIX (audit C1): prevent self-promotion to platform_admin and
-- cross-tenant moves via team_members UPDATE.
--
-- The tm_update RLS policy is `USING (is_admin() OR user_id = auth.uid())`
-- with NO `WITH CHECK`. Postgres reuses USING for the write check, so a
-- user editing their OWN row (user_id = auth.uid()) passes the check no
-- matter which columns change. Combined with the `authenticated` UPDATE
-- grant on the table, ANY sales rep could run:
--
--   UPDATE team_members SET role='platform_admin' WHERE user_id = auth.uid();
--
-- ...and instantly gain super-admin / cross-org access to every tenant.
--
-- RLS WITH CHECK cannot compare NEW vs OLD column values, so we enforce
-- the invariant with a BEFORE UPDATE trigger, which is the correct tool
-- for "these columns may not change unless you're privileged." This is
-- also defense-in-depth: it holds even if the RLS policy is later
-- loosened.
--
-- Allowed to change role / org_id:
--   * service_role (trusted server-side / backend functions)
--   * platform_admins (the agency managing white-label tenants)
-- Everyone else (reps editing their own profile, anon) may update other
-- fields (name, phone, etc.) but NOT role or org_id.

CREATE OR REPLACE FUNCTION public.prevent_team_member_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Trusted server-side context (service role key) may change anything.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Platform admins manage roles and tenant assignment across orgs.
  IF public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  -- Everyone else: role and org_id are immutable on UPDATE.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not authorized to change team member role'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'Not authorized to change team member organization'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_team_member_escalation ON public.team_members;
CREATE TRIGGER trg_prevent_team_member_escalation
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_team_member_privilege_escalation();
