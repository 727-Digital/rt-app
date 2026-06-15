-- FB Lead Form → rep/org routing.
--
-- FB Lead Forms don't capture a mailing address, so the ZIP-based
-- territory routing can't assign them — every FB lead falls into the
-- default Reliable Turf org unassigned, then has to be hand-moved to the
-- right rep. This table maps a Lead Form (by its Meta form_id, which is
-- present in every leadgen webhook payload) directly to an org + rep, so
-- leads land assigned to the right person the moment they arrive.
--
-- Add a row per form. To split a new metro later (e.g. Orlando), create a
-- separate Lead Form in Meta and insert a row pointing it at that rep.

CREATE TABLE IF NOT EXISTS public.fb_lead_form_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fb_form_id text NOT NULL UNIQUE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  team_member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fb_lead_form_routes ENABLE ROW LEVEL SECURITY;

-- Only platform admins manage routing from the client. The receive-lead
-- webhook reads it via the service-role key, which bypasses RLS.
DROP POLICY IF EXISTS "platform_admin_all_fb_lead_form_routes"
  ON public.fb_lead_form_routes;
CREATE POLICY "platform_admin_all_fb_lead_form_routes"
  ON public.fb_lead_form_routes
  FOR ALL
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Seed: the current Atlanta "Turf Leads" form → Pro Green South / Andy.
-- (All leads from this form route to Andy until a separate Orlando form
-- is created and mapped.)
INSERT INTO public.fb_lead_form_routes (fb_form_id, org_id, team_member_id, label)
VALUES (
  '1387820823385230',
  'ff259569-203c-4ab2-8b23-d46ca0e5dda1',
  'c4b1fddc-cb7b-4b1d-9561-154420520488',
  'Turf Leads -> Pro Green South / Andy Huffman (ATL)'
)
ON CONFLICT (fb_form_id) DO UPDATE
  SET org_id = EXCLUDED.org_id,
      team_member_id = EXCLUDED.team_member_id,
      label = EXCLUDED.label;
