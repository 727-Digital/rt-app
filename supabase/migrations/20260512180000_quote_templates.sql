-- Quote templates so reps don't re-type the same line items, warranty,
-- and cost defaults on every quote. Templates are scoped to an org and
-- editable by any authenticated team member of that org. Applying a
-- template just copies its fields into the new quote — there's no
-- runtime dependency, so deleting a template later doesn't break old
-- quotes built from it.

CREATE TABLE IF NOT EXISTS public.quote_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  warranty_text text,
  notes text,
  default_valid_days integer,
  materials_cost numeric DEFAULT 0,
  labor_cost numeric DEFAULT 0,
  overhead_cost numeric DEFAULT 0,
  profit_split_percent numeric DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_templates_org_idx
  ON public.quote_templates(org_id);

ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;

-- Any authenticated team member of the org can read templates.
DROP POLICY IF EXISTS quote_templates_select ON public.quote_templates;
CREATE POLICY quote_templates_select ON public.quote_templates
  FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT tm.org_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

-- Same membership check for insert / update / delete.
DROP POLICY IF EXISTS quote_templates_insert ON public.quote_templates;
CREATE POLICY quote_templates_insert ON public.quote_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT tm.org_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS quote_templates_update ON public.quote_templates;
CREATE POLICY quote_templates_update ON public.quote_templates
  FOR UPDATE
  TO authenticated
  USING (
    org_id IN (
      SELECT tm.org_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS quote_templates_delete ON public.quote_templates;
CREATE POLICY quote_templates_delete ON public.quote_templates
  FOR DELETE
  TO authenticated
  USING (
    org_id IN (
      SELECT tm.org_id FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
    )
  );
