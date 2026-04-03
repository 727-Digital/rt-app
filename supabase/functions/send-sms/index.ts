import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { lead_id, org_id, to_number, body } = await req.json();
    if (!to_number || !body) {
      return errorResponse("to_number and body are required");
    }

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_FROM_NUMBER");
    const messagingSid = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

    if (!sid || !token || (!from && !messagingSid)) {
      return errorResponse("Twilio credentials not configured", 500);
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const params = new URLSearchParams({
      To: to_number,
      Body: body,
    });

    // Prefer messaging service SID if available (better deliverability)
    if (messagingSid) {
      params.set("MessagingServiceSid", messagingSid);
    } else {
      params.set("From", from!);
    }

    const auth = btoa(`${sid}:${token}`);
    const twilioRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Twilio error:", twilioData);
      return errorResponse(twilioData.message || "Failed to send SMS", 500);
    }

    // Update the message record with Twilio SID and status
    if (lead_id) {
      const supabase = getServiceClient();
      await supabase
        .from("messages")
        .update({
          twilio_sid: twilioData.sid,
          status: twilioData.status || "queued",
          from_number: twilioData.from,
        })
        .eq("lead_id", lead_id)
        .eq("direction", "outbound")
        .eq("status", "queued")
        .order("created_at", { ascending: false })
        .limit(1);
    }

    return jsonResponse({
      sid: twilioData.sid,
      status: twilioData.status,
    });
  } catch (err) {
    console.error("send-sms error:", err);
    return errorResponse("Internal server error", 500);
  }
});
