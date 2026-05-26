-- Fix platform_admin RLS bypass policies. Inline `EXISTS (SELECT
-- FROM team_members ...)` inside an RLS policy can recurse when the
-- target table itself has RLS (team_members own SELECT policy gets
-- re-evaluated for each row checked inside the EXISTS). Symptom:
-- platform admins see empty result sets for tables we just added a
-- bypass for, because the inner check returns no rows.
--
-- Fix: hoist the role check into a SECURITY DEFINER function. The
-- function runs with table-owner privileges, bypassing RLS during
-- its single seq-scan of team_members. Cheap, no recursion.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = auth.uid()
      AND role = 'platform_admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

-- Rewrite every platform_admin bypass policy to call the function.
-- signal_house_numbers ------------------------------------------------------
DROP POLICY IF EXISTS "platform_admin_select_all_signal_house_numbers"
  ON public.signal_house_numbers;
CREATE POLICY "platform_admin_select_all_signal_house_numbers"
  ON public.signal_house_numbers
  FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "platform_admin_update_all_signal_house_numbers"
  ON public.signal_house_numbers;
CREATE POLICY "platform_admin_update_all_signal_house_numbers"
  ON public.signal_house_numbers
  FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "platform_admin_insert_all_signal_house_numbers"
  ON public.signal_house_numbers;
CREATE POLICY "platform_admin_insert_all_signal_house_numbers"
  ON public.signal_house_numbers
  FOR INSERT
  WITH CHECK (public.is_platform_admin());

-- team_members --------------------------------------------------------------
DROP POLICY IF EXISTS "platform_admin_select_all_team_members"
  ON public.team_members;
CREATE POLICY "platform_admin_select_all_team_members"
  ON public.team_members
  FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "platform_admin_update_all_team_members"
  ON public.team_members;
CREATE POLICY "platform_admin_update_all_team_members"
  ON public.team_members
  FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "platform_admin_insert_all_team_members"
  ON public.team_members;
CREATE POLICY "platform_admin_insert_all_team_members"
  ON public.team_members
  FOR INSERT
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "platform_admin_delete_all_team_members"
  ON public.team_members;
CREATE POLICY "platform_admin_delete_all_team_members"
  ON public.team_members
  FOR DELETE
  USING (public.is_platform_admin());

-- territories ---------------------------------------------------------------
DROP POLICY IF EXISTS "platform_admin_select_all_territories"
  ON public.territories;
CREATE POLICY "platform_admin_select_all_territories"
  ON public.territories
  FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "platform_admin_update_all_territories"
  ON public.territories;
CREATE POLICY "platform_admin_update_all_territories"
  ON public.territories
  FOR UPDATE
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "platform_admin_insert_all_territories"
  ON public.territories;
CREATE POLICY "platform_admin_insert_all_territories"
  ON public.territories
  FOR INSERT
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS "platform_admin_delete_all_territories"
  ON public.territories;
CREATE POLICY "platform_admin_delete_all_territories"
  ON public.territories
  FOR DELETE
  USING (public.is_platform_admin());

-- leads: rewrite the existing combined policy from
-- 20260521180000_platform_admin_cross_org.sql to use the helper too.
-- Same behavior, just no longer triggers the recursion path.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.leads'::regclass
      AND polcmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.leads', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "leads_select_scoped" ON public.leads
FOR SELECT
USING (
  public.is_platform_admin()
  OR (
    org_id IN (
      SELECT org_id FROM public.team_members WHERE user_id = auth.uid()
    )
    AND (
      EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.user_id = auth.uid()
          AND tm.org_id = leads.org_id
          AND tm.role IN ('admin', 'owner')
      )
      OR assigned_team_member_id IN (
        SELECT id FROM public.team_members WHERE user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.territories t
        JOIN public.team_members tm ON tm.id = t.team_member_id
        WHERE tm.user_id = auth.uid()
          AND t.org_id = leads.org_id
          AND t.is_active = true
          AND substring(leads.address from '\b(\d{5})\b') = ANY(t.zip_codes)
      )
    )
  )
);
