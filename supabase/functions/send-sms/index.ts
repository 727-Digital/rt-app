import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendSmsDetailed } from "../_shared/signalhouse.ts";
import { resolveOutboundNumberForLead } from "../_shared/numbers.ts";
import { sendMessengerMessage } from "../_shared/messenger.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { lead_id, org_id: _org_id, to_number, body, auto_claim_user_id } =
      await req.json();
    if (!to_number || !body) {
      return errorResponse("to_number and body are required");
    }

    const supabase = getServiceClient();

    // AUTHORIZATION (audit C4): this endpoint sends SMS / Messenger DMs
    // that cost money. The gateway only checks that *some* JWT is present
    // (the public anon key satisfies it), so we must verify the CALLER is
    // a real authenticated user who belongs to the lead's org before
    // sending anything. Prevents anyone with the anon key from blasting
    // SMS to arbitrary numbers on the company's dime.
    {
      const authHeader = req.headers.get("Authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!jwt) return errorResponse("Unauthorized", 401);
      const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
      const callerId = userData?.user?.id;
      if (userErr || !callerId) return errorResponse("Unauthorized", 401);
      if (!lead_id) return errorResponse("lead_id is required", 400);

      const { data: leadOrg } = await supabase
        .from("leads")
        .select("org_id")
        .eq("id", lead_id)
        .maybeSingle();
      if (!leadOrg) return errorResponse("Lead not found", 404);

      const callerOrgId = (leadOrg as { org_id: string }).org_id;
      const { data: membership } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", callerId)
        .eq("org_id", callerOrgId)
        .maybeSingle();
      const { data: platformAdminRows } = await supabase
        .from("team_members")
        .select("id")
        .eq("user_id", callerId)
        .eq("role", "platform_admin")
        .limit(1);
      const isPlatformAdmin = !!(platformAdminRows && platformAdminRows.length > 0);

      if (!membership && !isPlatformAdmin) {
        return errorResponse(
          "Forbidden — caller is not a member of this lead's organization",
          403,
        );
      }
    }

    // Messenger short-circuit: if this lead has an fb_psid the rep is
    // replying to a Page DM, not sending an SMS. Same edge function so
    // the frontend doesn't need to know the difference — channel is a
    // property of the lead, not the request. Skips Signal House
    // entirely and posts to Graph API instead.
    if (lead_id) {
      const { data: leadCh } = await supabase
        .from("leads")
        .select("fb_psid")
        .eq("id", lead_id)
        .maybeSingle();
      const psid = (leadCh as { fb_psid?: string | null } | null)?.fb_psid;
      if (psid) {
        const mResult = await sendMessengerMessage(psid, body);
        if (!mResult.success) {
          console.error("send-sms (messenger path) failed:", mResult);
          return errorResponse(mResult.error || "Failed to send Messenger DM", 500);
        }
        await supabase
          .from("messages")
          .update({
            twilio_sid: mResult.messageId ?? null,
            status: "queued",
          })
          .eq("lead_id", lead_id)
          .eq("direction", "outbound")
          .eq("channel", "messenger")
          .eq("status", "queued")
          .order("created_at", { ascending: false })
          .limit(1);
        return jsonResponse({
          sid: mResult.messageId,
          status: "queued",
          channel: "messenger",
          raw: mResult.raw,
        });
      }
    }

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
