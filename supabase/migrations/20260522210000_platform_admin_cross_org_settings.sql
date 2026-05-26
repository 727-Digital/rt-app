-- Platform admins need cross-org SELECT visibility on the settings
-- tables (signal_house_numbers, team_members, territories) so they
-- can manage white-label orgs (Pro Green South, etc.) from a single
-- Reliable Turf session. Without this, the Settings page hides PGS
-- phone numbers / reps / territories even though Ty's role is
-- platform_admin.
--
-- Mirrors the cross-org policy already in place on the `leads` table
-- (migration 20260521180000). Same pattern: keep the existing
-- per-org policies in place for rank-and-file reps; add a NEW
-- permissive policy that returns true whenever the caller's
-- team_members.role is 'platform_admin'.

-- signal_house_numbers ------------------------------------------------------
DROP POLICY IF EXISTS "platform_admin_select_all_signal_house_numbers"
  ON public.signal_house_numbers;
CREATE POLICY "platform_admin_select_all_signal_house_numbers"
  ON public.signal_house_numbers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role = 'platform_admin'
    )
  );

-- team_members --------------------------------------------------------------
DROP POLICY IF EXISTS "platform_admin_select_all_team_members"
  ON public.team_members;
CREATE POLICY "platform_admin_select_all_team_members"
  ON public.team_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role = 'platform_admin'
    )
  );

-- territories ---------------------------------------------------------------
DROP POLICY IF EXISTS "platform_admin_select_all_territories"
  ON public.territories;
CREATE POLICY "platform_admin_select_all_territories"
  ON public.territories
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role = 'platform_admin'
    )
  );

-- Mirror policies for UPDATE too — the admin-multi-org workflow in
-- Settings reassigns numbers, edits team members, and tweaks
-- territories across orgs. Without UPDATE allowance the platform
-- admin would be able to SEE the row but not actually save changes
-- through the UI.
DROP POLICY IF EXISTS "platform_admin_update_all_signal_house_numbers"
  ON public.signal_house_numbers;
CREATE POLICY "platform_admin_update_all_signal_house_numbers"
  ON public.signal_house_numbers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "platform_admin_insert_all_signal_house_numbers"
  ON public.signal_house_numbers;
CREATE POLICY "platform_admin_insert_all_signal_house_numbers"
  ON public.signal_house_numbers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "platform_admin_update_all_team_members"
  ON public.team_members;
CREATE POLICY "platform_admin_update_all_team_members"
  ON public.team_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role = 'platform_admin'
    )
  );

DROP POLICY IF EXISTS "platform_admin_update_all_territories"
  ON public.territories;
CREATE POLICY "platform_admin_update_all_territories"
  ON public.territories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role = 'platform_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role = 'platform_admin'
    )
  );
