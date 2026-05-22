-- Platform admins (Ty) need cross-org visibility — without this, the
-- per-rep lead-scoping policy added in 20260521120000 hides Pro Green
-- South leads from Ty's Reliable Turf session even though he's the one
-- who needs to manage both orgs.
--
-- Replace the leads SELECT policy with one that lets platform_admin
-- bypass the org_id gate entirely. Same scoping logic still applies for
-- everyone else.

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
  -- Platform admins see every lead in every org.
  EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.role = 'platform_admin'
  )
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
