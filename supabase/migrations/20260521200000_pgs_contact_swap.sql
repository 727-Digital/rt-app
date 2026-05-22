-- Swap Pro Green South's public contact info to route directly to Andy.
-- Office line stays in the org's records via the company website if
-- needed, but for the quote header we want the customer to land on
-- Andy's mobile and his email since he's the sole rep on this org.

UPDATE public.organizations
SET
  phone = '(319) 493-1755',
  email = 'andyhuffman6121@icloud.com'
WHERE slug = 'pro-green-south';
