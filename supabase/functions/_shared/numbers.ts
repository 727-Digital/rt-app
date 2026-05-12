// Outbound number resolution.
//
// Given a lead, pick which Signal House number to send from:
//   1. If lead has assigned_team_member_id AND that rep has a signal_house_numbers
//      row, use that rep's number.
//   2. Else use the org's is_default_for_org=true number.
//   3. Else fall back to the SIGNALHOUSE_FROM_NUMBER env var (legacy single-number
//      behavior). This keeps everything working before any row exists in
//      signal_house_numbers, so the migration is safe to run before backfill.
//
// All resolvers swallow non-fatal errors and fall back; we never want
// notification flows to fail because a row is missing.

import type { createClient } from "jsr:@supabase/supabase-js@2";

type Supabase = ReturnType<typeof createClient>;

interface ResolveContext {
  leadId?: string | null;
  orgId?: string | null;
  assignedTeamMemberId?: string | null;
}

/**
 * Returns a Signal House phone number in digits-only format (e.g. "16784340360").
 * Suitable to pass straight to signalhouse.sendSms as the `from` override.
 */
export async function resolveOutboundNumber(
  supabase: Supabase,
  ctx: ResolveContext,
): Promise<string | null> {
  // 1. Specific rep's number
  if (ctx.assignedTeamMemberId) {
    const { data } = await supabase
      .from("signal_house_numbers")
      .select("phone_number")
      .eq("team_member_id", ctx.assignedTeamMemberId)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    const num = (data as { phone_number?: string } | null)?.phone_number;
    if (num) return num;
  }

  // 2. Org default
  if (ctx.orgId) {
    const { data } = await supabase
      .from("signal_house_numbers")
      .select("phone_number")
      .eq("org_id", ctx.orgId)
      .eq("is_default_for_org", true)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    const num = (data as { phone_number?: string } | null)?.phone_number;
    if (num) return num;
  }

  // 3. Env var legacy fallback
  return Deno.env.get("SIGNALHOUSE_FROM_NUMBER") ?? null;
}

/**
 * Pulls the lead's org + assignment in one query then resolves. Convenience
 * for callers that have a lead_id but not the rest of the context.
 */
export async function resolveOutboundNumberForLead(
  supabase: Supabase,
  leadId: string,
): Promise<string | null> {
  const { data: lead } = await supabase
    .from("leads")
    .select("org_id, assigned_team_member_id")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return Deno.env.get("SIGNALHOUSE_FROM_NUMBER") ?? null;
  const row = lead as { org_id: string | null; assigned_team_member_id: string | null };
  return resolveOutboundNumber(supabase, {
    leadId,
    orgId: row.org_id,
    assignedTeamMemberId: row.assigned_team_member_id,
  });
}
