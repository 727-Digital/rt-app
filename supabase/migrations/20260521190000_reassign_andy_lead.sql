-- One-off: move the "Andy" test lead from Reliable Turf to Pro Green
-- South and reassign it to Andy Huffman. Lead got accidentally claimed
-- by Ty earlier, and since Andy is now on PGS the lead has to follow
-- him to that org (otherwise the assigned_team_member_id would point
-- to a rep in a different org than the lead's org_id — broken).

UPDATE public.leads
SET
  org_id = (SELECT org_id FROM public.team_members WHERE email = 'andyhuffman6121@icloud.com'),
  assigned_team_member_id = (SELECT id FROM public.team_members WHERE email = 'andyhuffman6121@icloud.com')
WHERE id = '5d5fb7fa-0762-4b51-b7d6-93cb8037decf';

-- Also move any quotes attached to this lead to the same org, so the
-- public quote view + send-quote function pull Pro Green South branding
-- on next send.
UPDATE public.quotes
SET org_id = (SELECT org_id FROM public.team_members WHERE email = 'andyhuffman6121@icloud.com')
WHERE lead_id = '5d5fb7fa-0762-4b51-b7d6-93cb8037decf';
