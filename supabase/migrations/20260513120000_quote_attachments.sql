-- File attachments on quotes. Visible to both the team building the quote
-- and to the customer viewing the public /q/{id} page. Stores arbitrary
-- file types — images render inline in the preview, everything else gets
-- a download button.
--
-- Architecture:
--   - Metadata row in public.quote_attachments
--   - File bytes in storage bucket "quote-attachments"
--   - Path pattern: {org_id}/{quote_id}/{uuid}-{filename}
--   - Public bucket — anyone with the URL can fetch. The quote_id is the
--     security boundary (UUID, unguessable). Same model as how we
--     gate the public quote view itself.

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.quote_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,        -- storage path within the bucket
  file_url text NOT NULL,         -- public URL (cached at insert time)
  mime_type text,
  file_size bigint,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_attachments_quote_idx
  ON public.quote_attachments(quote_id);

ALTER TABLE public.quote_attachments ENABLE ROW LEVEL SECURITY;

-- Authenticated org members can CRUD attachments for their org's quotes.
DROP POLICY IF EXISTS quote_attachments_select ON public.quote_attachments;
CREATE POLICY quote_attachments_select ON public.quote_attachments
  FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT tm.org_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS quote_attachments_insert ON public.quote_attachments;
CREATE POLICY quote_attachments_insert ON public.quote_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT tm.org_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS quote_attachments_delete ON public.quote_attachments;
CREATE POLICY quote_attachments_delete ON public.quote_attachments
  FOR DELETE TO authenticated
  USING (
    org_id IN (
      SELECT tm.org_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 2. Storage bucket (public read)
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('quote-attachments', 'quote-attachments', true, 26214400)  -- 25MB cap
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 26214400;

-- Authenticated team members can upload/delete to their org's namespace.
-- Path convention: {org_id}/{quote_id}/{filename}. The first path segment
-- is org_id, which we cross-reference with team_members.
DROP POLICY IF EXISTS qa_upload ON storage.objects;
CREATE POLICY qa_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quote-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT tm.org_id::text FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS qa_delete ON storage.objects;
CREATE POLICY qa_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'quote-attachments'
    AND (storage.foldername(name))[1] IN (
      SELECT tm.org_id::text FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Public read so customers can view attachments without a session.
DROP POLICY IF EXISTS qa_read ON storage.objects;
CREATE POLICY qa_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'quote-attachments');

-- ---------------------------------------------------------------------------
-- 3. Extend get_public_quote() to include attachments
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
  WHERE q.id = quote_uuid;
  RETURN result;
END;
$$;
