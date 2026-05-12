-- Per-rep Signal House numbers + ZIP-based rep territories + lead rep
-- assignment. Wire this up once via the Supabase SQL editor; the app code
-- already falls back to the env-var SIGNALHOUSE_FROM_NUMBER when no row
-- exists, so the migration is safe to run before configuring any data.

-- 1. Inventory of Signal House numbers per org, optionally bound to a rep.
create table if not exists signal_house_numbers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  phone_number text not null,           -- digits only, e.g. '16784340360'
  display_number text not null,         -- '(678) 434-0360' for UI
  team_member_id uuid references team_members(id) on delete set null,
  is_default_for_org boolean not null default false,
  status text not null default 'active', -- active | released
  signal_house_campaign_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists signal_house_numbers_phone_unique
  on signal_house_numbers(phone_number);
create unique index if not exists signal_house_numbers_one_per_rep
  on signal_house_numbers(team_member_id)
  where team_member_id is not null;
create unique index if not exists signal_house_numbers_one_default_per_org
  on signal_house_numbers(org_id)
  where is_default_for_org = true;
create index if not exists signal_house_numbers_org_idx
  on signal_house_numbers(org_id);

alter table signal_house_numbers enable row level security;

create policy "Org members read their numbers"
  on signal_house_numbers for select
  using (
    org_id in (
      select org_id from team_members where user_id = auth.uid()
    )
  );

create policy "Org admins manage their numbers"
  on signal_house_numbers for all
  using (
    org_id in (
      select org_id from team_members
      where user_id = auth.uid()
        and role in ('owner', 'admin', 'platform_admin')
    )
  )
  with check (
    org_id in (
      select org_id from team_members
      where user_id = auth.uid()
        and role in ('owner', 'admin', 'platform_admin')
    )
  );

-- 2. Rep-level routing on territories (optional column; null = org-level only).
alter table territories
  add column if not exists team_member_id uuid references team_members(id) on delete set null;
create index if not exists territories_team_member_id_idx on territories(team_member_id);

-- 3. Which rep owns each lead. Set on intake from territory match, or
--    later when a rep claims / takes the first action.
alter table leads
  add column if not exists assigned_team_member_id uuid references team_members(id) on delete set null;
create index if not exists leads_assigned_team_member_id_idx
  on leads(assigned_team_member_id);
