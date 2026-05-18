-- Phase 2 + 3 + 4 of the Southern-Turf-style quote rebuild.
-- Adds: per-quote installation detail fields, per-quote signature
-- capture, and org-level boilerplate (process steps, jobsite expectations,
-- notes, payment terms, T&Cs). Updates get_public_quote() to return
-- everything in one call.

-- ---------------------------------------------------------------------------
-- 1. Per-quote installation detail fields
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS turf_area_description text,
  ADD COLUMN IF NOT EXISTS edging_coverage text,
  ADD COLUMN IF NOT EXISTS areas_of_caution text,
  ADD COLUMN IF NOT EXISTS drainage_notes text,
  ADD COLUMN IF NOT EXISTS projected_start_date text,  -- free text, can be "TBD"
  ADD COLUMN IF NOT EXISTS length_estimate text,        -- e.g. "1-2 Days"
  ADD COLUMN IF NOT EXISTS client_signature_name text,
  ADD COLUMN IF NOT EXISTS client_signature_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Org-level quote-template defaults
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS process_steps jsonb DEFAULT '[
    "Excavation as needed to allow for base",
    "Cap sprinkler heads upon request",
    "Install base & grade as needed",
    "Compact base as needed",
    "Lay weed control fabric as needed",
    "Add edging as needed",
    "Install & seam artificial turf",
    "Spread infill",
    "Power broom turf system"
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS jobsite_expectations jsonb DEFAULT '[
    "Maintain clean jobsite",
    "Nightly clean up",
    "Work on consecutive days (weather permitting)",
    "Goal is a reference letter"
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS boilerplate_notes jsonb DEFAULT '[
    "Pricing listed reflects total investment (Artificial Turf System, Labor & Materials).",
    "15 Year Turf Manufacturer''s Product Limited Warranty & 3 Year Company Labor Limited Warranty.",
    "Company carries $1,000,000 liability insurance.",
    "Owner agrees to move all movable items from the turf area prior to installation.",
    "All discounts & coupons have been applied to this proposal. No further discounts available.",
    "Standard excavation to allow for base material installation; base amount varies by site needs. Additional excavation or build-up will incur extra costs, documented in a signed electronic change order.",
    "Low-E Coated Window Advisory: Reflections from windows coated with Low-E film can damage or burn artificial turf. Turf burn is not covered under either the Company''s or the manufacturer''s limited warranty.",
    "Company strongly recommends all irrigation system parts, such as heads and piping, be removed from under the turf installation area."
  ]'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_terms_down_pct integer DEFAULT 40,
  ADD COLUMN IF NOT EXISTS payment_terms_balance_pct integer DEFAULT 60,
  ADD COLUMN IF NOT EXISTS credit_card_fee_pct numeric(4,2) DEFAULT 3.0,
  ADD COLUMN IF NOT EXISTS default_length_estimate text DEFAULT '1-2 Days',
  ADD COLUMN IF NOT EXISTS terms_and_conditions_long text;

-- ---------------------------------------------------------------------------
-- 3. Extend get_public_quote() to expose everything the customer page needs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_quote(quote_uuid uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', q.id,
    'lead_id', q.lead_id,
    'org_id', q.org_id,
    'line_items', q.line_items,
    'subtotal', q.subtotal,
    'total', q.total,
    'status', q.status,
    'valid_until', q.valid_until,
    'notes', q.notes,
    'warranty_text', q.warranty_text,
    'sent_at', q.sent_at,
    'viewed_at', q.viewed_at,
    'approved_at', q.approved_at,
    'rejected_at', q.rejected_at,
    'expires_at', q.expires_at,
    'payment_status', q.payment_status,
    'payment_method', q.payment_method,
    'stripe_checkout_session_id', q.stripe_checkout_session_id,
    'stripe_payment_intent_id', q.stripe_payment_intent_id,
    'created_at', q.created_at,
    'updated_at', q.updated_at,
    'turf_area_description', q.turf_area_description,
    'edging_coverage', q.edging_coverage,
    'areas_of_caution', q.areas_of_caution,
    'drainage_notes', q.drainage_notes,
    'projected_start_date', q.projected_start_date,
    'length_estimate', q.length_estimate,
    'client_signature_name', q.client_signature_name,
    'client_signature_at', q.client_signature_at,
    'lead', CASE WHEN l.id IS NULL THEN NULL ELSE json_build_object(
      'id', l.id,
      'name', l.name,
      'email', l.email,
      'phone', l.phone,
      'address', l.address,
      'install_date', l.install_date
    ) END,
    'organization', CASE WHEN o.id IS NULL THEN NULL ELSE json_build_object(
      'id', o.id,
      'name', o.name,
      'email', o.email,
      'phone', o.phone,
      'logo_url', o.logo_url,
      'primary_color', o.primary_color,
      'address', o.address,
      'process_steps', o.process_steps,
      'jobsite_expectations', o.jobsite_expectations,
      'boilerplate_notes', o.boilerplate_notes,
      'payment_terms_down_pct', o.payment_terms_down_pct,
      'payment_terms_balance_pct', o.payment_terms_balance_pct,
      'credit_card_fee_pct', o.credit_card_fee_pct,
      'default_length_estimate', o.default_length_estimate,
      'terms_and_conditions_long', o.terms_and_conditions_long
    ) END,
    'turf_advisor', CASE WHEN tm.id IS NULL THEN NULL ELSE json_build_object(
      'id', tm.id,
      'name', tm.name,
      'email', tm.email,
      'phone', tm.phone
    ) END,
    'attachments', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', a.id,
        'file_name', a.file_name,
        'file_url', a.file_url,
        'mime_type', a.mime_type,
        'file_size', a.file_size,
        'created_at', a.created_at
      ) ORDER BY a.created_at), '[]'::json)
      FROM public.quote_attachments a
      WHERE a.quote_id = q.id
    )
  ) INTO result
  FROM public.quotes q
  LEFT JOIN public.leads l ON l.id = q.lead_id
  LEFT JOIN public.organizations o ON o.id = q.org_id
  LEFT JOIN public.team_members tm ON tm.id = l.assigned_team_member_id
  WHERE q.id = quote_uuid;
  RETURN result;
END;
$$;
