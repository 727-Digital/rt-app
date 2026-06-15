-- Lead Sync Watchdog.
--
-- Webhooks are best-effort and can silently fail (as the FB signature bug
-- proved — 2 days of dropped leads). This adds a reconciliation layer:
--   1. Every FB lead we ingest is stamped with its Meta leadgen_id, so we
--      can match FB Lead Center against our app exactly.
--   2. fb_lead_sync holds one row per FB lead with its presence in both
--      systems, populated by the reconcile-fb-leads job (which also
--      auto-ingests anything the webhook missed).
--   3. The in-app "Lead Sync" card reads this table to confirm, per lead,
--      that Facebook AND the Reliable Turf app both have it.

-- Exact reconciliation key on leads.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fb_leadgen_id text;

CREATE UNIQUE INDEX IF NOT EXISTS leads_fb_leadgen_id_uidx
  ON public.leads (fb_leadgen_id)
  WHERE fb_leadgen_id IS NOT NULL;

-- One row per FB Lead Center lead + its sync state.
CREATE TABLE IF NOT EXISTS public.fb_lead_sync (
  leadgen_id text PRIMARY KEY,
  form_id text,
  lead_name text,
  lead_phone text,
  fb_created_time timestamptz,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  app_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  in_app boolean NOT NULL DEFAULT false,
  recovered boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fb_lead_sync_created_idx
  ON public.fb_lead_sync (fb_created_time DESC);

ALTER TABLE public.fb_lead_sync ENABLE ROW LEVEL SECURITY;

-- Read: platform admins (agency) see all; org members see their org's
-- sync rows. The reconcile job writes via the service-role key (bypasses
-- RLS), so no write policy for clients is needed.
DROP POLICY IF EXISTS "fb_lead_sync_select" ON public.fb_lead_sync;
CREATE POLICY "fb_lead_sync_select" ON public.fb_lead_sync
  FOR SELECT
  USING (
    public.is_platform_admin()
    OR org_id IN (
      SELECT org_id FROM public.team_members WHERE user_id = auth.uid()
    )
  );
