-- Per-rep lead visibility.
--
-- Sales/installer reps now see ONLY:
--   (a) leads assigned directly to them (leads.assigned_team_member_id)
--   (b) leads whose ZIP falls inside one of their territories
--       (territories.zip_codes ∋ ZIP extracted from leads.address)
--
-- Admins / platform_admins / owners continue to see ALL leads in their org.
-- Cross-org isolation is preserved (org_id check applies to everyone).
--
-- Customers, quotes, and messages all flow from leads via FK; this policy
-- is the choke point. INSERT / UPDATE / DELETE policies are left untouched
-- because (a) reps can't see leads they're not allowed to anyway, so they
-- can't reference them, and (b) lead intake comes from service-role
-- functions (receive-lead) which bypass RLS.

-- Drop any existing SELECT policies on leads so we own the read path.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'public.leads'::regclass
      AND polcmd = 'r'   -- 'r' = SELECT
  LOOP
    EXECUTE format('DROP POLICY %I ON public.leads', pol.polname);
  END LOOP;
END $$;

CREATE POLICY "leads_select_scoped" ON public.leads
FOR SELECT
USING (
  -- Same-org membership is the outer gate. Stops cross-org reads cold.
  org_id IN (
    SELECT org_id FROM public.team_members WHERE user_id = auth.uid()
  )
  AND (
    -- Admins/owners/platform_admins see everything in their org.
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.org_id = leads.org_id
        AND tm.role IN ('admin', 'platform_admin', 'owner')
    )
    -- Direct assignment: rep owns this lead.
    OR assigned_team_member_id IN (
      SELECT id FROM public.team_members WHERE user_id = auth.uid()
    )
    -- Territory match: lead's ZIP is in one of the caller's active territories.
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
);
