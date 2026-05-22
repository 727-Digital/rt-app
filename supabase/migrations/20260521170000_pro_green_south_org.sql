-- Create Pro Green South Outdoor Solutions as a separate org, then move
-- Andy Huffman + his Greater Atlanta territory under it. Quote-template
-- boilerplate is copied from Reliable Turf for now; Andy/admin can edit
-- via Settings later.

-- 1. Pro Green South org. Branding from his business card + website:
--      logo:  hibuwebsites CDN copy of the company logo
--      red:   #A4332B (brand wordmark color)
--      addr:  4205 Jenkins Court, Suwanee, GA 30024
--      phone: 770-831-4538 (office)
--      email: info@progreenonline.com (matches the public site domain)
--    Pricing + payment methods + boilerplate inherited from Reliable Turf
--    via the SELECT subquery so Andy starts with sensible defaults rather
--    than an empty quote template.
INSERT INTO public.organizations (
  name,
  slug,
  logo_url,
  primary_color,
  address,
  phone,
  email,
  pricing_min,
  pricing_max,
  payment_methods,
  onboarding_complete,
  warranty_text,
  terms_and_conditions_long,
  process_steps,
  jobsite_expectations,
  boilerplate_notes,
  payment_terms_down_pct,
  payment_terms_balance_pct,
  credit_card_fee_pct,
  default_length_estimate
)
SELECT
  'Pro Green South Outdoor Solutions',
  'pro-green-south',
  'https://le-cdn.hibuwebsites.com/7aec18755732418fb9a73e7198f19c59/dms3rep/multi/opt/progreen-outdoor-solutions-logo-588w.jpg',
  '#A4332B',
  '4205 Jenkins Court, Suwanee, GA 30024',
  '770-831-4538',
  'info@progreenonline.com',
  pricing_min,
  pricing_max,
  payment_methods,
  true,
  warranty_text,
  terms_and_conditions_long,
  process_steps,
  jobsite_expectations,
  boilerplate_notes,
  payment_terms_down_pct,
  payment_terms_balance_pct,
  credit_card_fee_pct,
  default_length_estimate
FROM public.organizations
WHERE id = 'd22f83b6-e951-4bea-9042-2801754d8906'  -- Reliable Turf
ON CONFLICT (slug) DO NOTHING;

-- 2. Reassign Andy's team_members row to Pro Green South. With the
--    per-rep lead-scoping RLS, this immediately removes his visibility
--    of Reliable Turf leads and gives him Pro Green South's leads.
UPDATE public.team_members
SET org_id = (SELECT id FROM public.organizations WHERE slug = 'pro-green-south')
WHERE email = 'andyhuffman6121@icloud.com';

-- 3. Move his Greater Atlanta territory (127 zip codes) along with him.
--    Territory keeps the same ZIPs and rep mapping; just lives under
--    the new org now.
UPDATE public.territories
SET org_id = (SELECT id FROM public.organizations WHERE slug = 'pro-green-south')
WHERE team_member_id = (
  SELECT id FROM public.team_members
  WHERE email = 'andyhuffman6121@icloud.com'
  LIMIT 1
);
