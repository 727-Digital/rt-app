-- Messenger (FB Page DM) integration. Three small schema bumps so the
-- existing receive-lead webhook can route Page messaging events the same
-- way it routes leadgen, and the existing rep-reply path can send DMs
-- back out via Graph API.
--
-- 1. organizations.fb_page_id — maps a Meta Page ID to an org row so the
--    inbound webhook knows whether to file a DM under Reliable Turf or
--    Pro Green South (or whoever connects next).
--
-- 2. leads.fb_psid — Page-Scoped ID of the FB user. Stable per
--    (page, user), so we can dedupe inbound threads and address outbound
--    DMs to the right person via POST /me/messages.
--
-- Both are UNIQUE: a Page maps to at most one org, and a PSID maps to at
-- most one lead per page (we let the existing UNIQUE handle dedup; a
-- conflict means "we already have this lead, append the message").

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS fb_page_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_fb_page_id_uidx
  ON public.organizations (fb_page_id)
  WHERE fb_page_id IS NOT NULL;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fb_psid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS leads_fb_psid_uidx
  ON public.leads (fb_psid)
  WHERE fb_psid IS NOT NULL;

-- Seed the Reliable Turf Page ID (1004538636077014) — same Page that the
-- leadgen subscription was attached to in migration 20260522 work.
UPDATE public.organizations
SET fb_page_id = '1004538636077014'
WHERE slug = 'reliable-turf'
  AND (fb_page_id IS NULL OR fb_page_id = '');
