import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendSmsDetailed } from "../_shared/signalhouse.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { lead_id, org_id: _org_id, to_number, body } = await req.json();
    if (!to_number || !body) {
      return errorResponse("to_number and body are required");
    }

    const result = await sendSmsDetailed(to_number, body);

    if (!result.success) {
      console.error("send-sms via Signal House failed:", result);
      return errorResponse(result.error || "Failed to send SMS", 500);
    }

    // Update the most recent queued outbound message row with the provider SID + status.
    if (lead_id) {
      const supabase = getServiceClient();
      await supabase
        .from("messages")
        .update({
          twilio_sid: result.messageId ?? null, // legacy column — reused until renamed to provider_sid
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
      raw: result.raw,
    });
  } catch (err) {
    console.error("send-sms error:", err);
    return errorResponse("Internal server error", 500);
  }
});
