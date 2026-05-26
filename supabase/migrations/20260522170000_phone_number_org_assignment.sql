-- Place each Signal House number on the right org and reassign the
-- Atlanta line to Andy.
--
-- 678-434-0360 is an Atlanta area code — belongs on Pro Green South
-- and should ring through to Andy Huffman, the sole PGS rep.
-- 407 area code is Orlando — belongs on Reliable Turf as a placeholder
-- until the Orlando/Tampa rep is added to that org.
--
-- The signal_house_numbers UI currently scopes the assignee dropdown
-- to the session's org, so a cross-org reassignment can't happen
-- through the app yet. SQL is the fastest path.

-- 1) 678-434-0360 → Pro Green South + assign to Andy.
--    Match by suffix so the row matches whether the number is stored
--    as '16784340360', '+16784340360', '6784340360', etc.
UPDATE public.signal_house_numbers
SET
  org_id = (SELECT id FROM public.organizations WHERE slug = 'pro-green-south'),
  team_member_id = (SELECT id FROM public.team_members WHERE email = 'andyhuffman6121@icloud.com'),
  is_default_for_org = false
WHERE phone_number LIKE '%6784340360';

-- 2) Any 407 number stays on Reliable Turf and gets cleared of stale
--    team_member assignment (Cartee Test or similar). Default for the
--    org so it's the fallback caller-ID for unassigned RT leads.
UPDATE public.signal_house_numbers
SET
  org_id = 'd22f83b6-e951-4bea-9042-2801754d8906',  -- Reliable Turf
  team_member_id = NULL,
  is_default_for_org = true
WHERE phone_number ~ '407[0-9]{7}';
