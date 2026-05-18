-- Extend get_public_quote() to include the assigned rep (the "Turf
-- Advisor" on the printed quote). Pulls from leads.assigned_team_member_id
-- to team_members. We hand the customer the rep's name, phone, and email
-- so the quote feels personally signed.

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
      'address', o.address
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
