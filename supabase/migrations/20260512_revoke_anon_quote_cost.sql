-- Defense-in-depth: hide internal margin data from the anonymous customer
-- view of a quote. Even if a future query path forgets to whitelist columns,
-- the anon Postgres role cannot read materials_cost, labor_cost,
-- overhead_cost, or profit_split_percent.
--
-- The customer-facing /q/{quote_id} page uses the anon key from the browser.
-- Without this revoke, a customer who opens DevTools could see our cost
-- breakdown in the network response.
--
-- Postgres ignores column-level revokes if the role still has table-level
-- SELECT, so we have to drop the table grant first and then re-grant only
-- the customer-safe columns. authenticated role is unaffected — it keeps
-- the default full table SELECT, so admin/QuoteBuilder/financials reads
-- continue to work.

REVOKE SELECT ON public.quotes FROM anon;

GRANT SELECT (
  id,
  lead_id,
  org_id,
  line_items,
  subtotal,
  total,
  status,
  valid_until,
  notes,
  warranty_text,
  sent_at,
  viewed_at,
  approved_at,
  rejected_at,
  expires_at,
  payment_status,
  payment_method,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  created_at,
  updated_at
) ON public.quotes TO anon;
