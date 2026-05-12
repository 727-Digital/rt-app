import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendSmsDetailed } from "../_shared/signalhouse.ts";
import { resolveOutboundNumberForLead } from "../_shared/numbers.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { lead_id, org_id: _org_id, to_number, body, auto_claim_user_id } =
      await req.json();
    if (!to_number || !body) {
      return errorResponse("to_number and body are required");
    }

    const supabase = getServiceClient();

    // Optional auto-claim: when an authenticated rep texts an unassigned
    // lead, they take ownership. The CRM client passes its user.id as
    // auto_claim_user_id; we resolve it to the team_members row and set
    // assigned_team_member_id BEFORE picking the number, so the rep's own
    // Signal House number sends.
    if (auto_claim_user_id && lead_id) {
      try {
        const { data: lead } = await supabase
          .from("leads")
          .select("assigned_team_member_id, org_id")
          .eq("id", lead_id)
          .maybeSingle();
        if (lead && !(lead as { assigned_team_member_id: string | null }).assigned_team_member_id) {
          const { data: member } = await supabase
            .from("team_members")
            .select("id")
            .eq("user_id", auto_claim_user_id)
            .eq("org_id", (lead as { org_id: string }).org_id)
            .maybeSingle();
          const memberId = (member as { id?: string } | null)?.id;
          if (memberId) {
            await supabase
              .from("leads")
              .update({ assigned_team_member_id: memberId })
              .eq("id", lead_id);
          }
        }
      } catch (e) {
        console.warn("[send-sms] auto-claim failed (continuing):", e);
      }
    }

    // Resolve which Signal House number this lead's outbound should use.
    // Falls back through rep number → org default → env var.
    const fromOverride = lead_id
      ? await resolveOutboundNumberForLead(supabase, lead_id)
      : null;

    const result = await sendSmsDetailed(to_number, body, fromOverride);

    if (!result.success) {
      console.error("send-sms via Signal House failed:", result);
      return errorResponse(result.error || "Failed to send SMS", 500);
    }

    // Update the most recent queued outbound message row with the provider SID
    // + status, and record the from_number actually used.
    if (lead_id) {
      await supabase
        .from("messages")
        .update({
          twilio_sid: result.messageId ?? null, // legacy column name; provider-agnostic
          from_number: fromOverride ?? null,
          status: "queued",
        })
        .eq("lead_id", lead_id)
        .eq("direction", "outbound")
        .eq("status", "queued")
        .order("created_at", { ascending: false })
        .limit(1);
    }

    return jsonResponse({
      sid: result.messageId,
      status: "queued",
      from: fromOverride,
      raw: result.raw,
    });
  } catch (err) {
    console.error("send-sms error:", err);
    return errorResponse("Internal server error", 500);
  }
});
