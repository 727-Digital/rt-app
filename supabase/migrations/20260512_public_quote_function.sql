-- Public-quote read path.
--
-- The customer-facing /q/{quote_id} page is unauthenticated, so it hits the
-- anon Postgres role. anon does NOT have RLS access to the leads table, so a
-- naive `quotes select *, lead:leads(*)` returns the quote but with lead=null,
-- which crashes the renderer.
--
-- Rather than weaken the leads RLS (which would let anyone with any quote_id
-- enumerate every lead that has a quote attached), expose ONE specific
-- joined-quote shape via a SECURITY DEFINER function. The function runs with
-- owner privileges so it can read leads and organizations directly. It only
-- returns customer-safe fields — no materials_cost / labor_cost / overhead
-- / profit_split, no internal lead notes / status / loss reasons, etc.

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
    'lead', CASE WHEN l.id IS NULL THEN NULL ELSE json_build_object(
      'id', l.id,
      'name', l.name,
      'email', l.email,
      'phone', l.phone,
      'address', l.address
    ) END,
    'organization', CASE WHEN o.id IS NULL THEN NULL ELSE json_build_object(
      'id', o.id,
      'name', o.name,
      'email', o.email,
      'phone', o.phone,
      'logo_url', o.logo_url,
      'primary_color', o.primary_color,
      'address', o.address
    ) END
  ) INTO result
  FROM public.quotes q
  LEFT JOIN public.leads l ON l.id = q.lead_id
  LEFT JOIN public.organizations o ON o.id = q.org_id
  WHERE q.id = quote_uuid;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_quote(uuid) TO anon, authenticated;
