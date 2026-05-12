import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { quote_id, ip_address } = await req.json();
    if (!quote_id) return errorResponse("quote_id is required");

    const supabase = getServiceClient();
    const userAgent = req.headers.get("user-agent") || null;

    const { error: viewErr } = await supabase.from("quote_views").insert({
      quote_id,
      ip_address: ip_address || null,
      user_agent: userAgent,
      viewed_at: new Date().toISOString(),
    });

    if (viewErr) {
      console.error("Failed to insert quote_view:", viewErr);
      return errorResponse("Failed to track view", 500);
    }

    const { data: quote } = await supabase
      .from("quotes")
      .select("status, lead_id, org_id")
      .eq("id", quote_id)
      .single();

    if (quote && quote.status === "sent") {
      await supabase
        .from("quotes")
        .update({
          status: "viewed",
          viewed_at: new Date().toISOString(),
        })
        .eq("id", quote_id);

      await supabase
        .from("leads")
        .update({ status: "quote_viewed" })
        .eq("id", quote.lead_id);
    }

    if (quote?.lead_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      // Resolve org_id from quote or lead
      let orgId = quote.org_id;
      if (!orgId) {
        const { data: lead } = await supabase
          .from("leads")
          .select("org_id")
          .eq("id", quote.lead_id)
          .single();
        orgId = lead?.org_id;
      }

      // One-per-hour throttle. Customers often refresh quote pages multiple
      // times; without this every reload pings the rep with another SMS,
      // email, AND push. Look for any prior quote_viewed notification on
      // this quote within the last hour — if found, skip the fanout.
      const oneHourAgoIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: recent } = await supabase
        .from("notifications")
        .select("id")
        .eq("quote_id", quote_id)
        .eq("type", "quote_viewed")
        .gte("sent_at", oneHourAgoIso)
        .limit(1);

      const throttled = (recent?.length ?? 0) > 0;

      if (!throttled) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              lead_id: quote.lead_id,
              quote_id,
              type: "quote_viewed",
              org_id: orgId,
            }),
          });
        } catch (notifyErr) {
          console.error("Failed to notify team:", notifyErr);
        }
      } else {
        console.log(
          `[track-quote-view] suppressed duplicate quote_viewed notify for ${quote_id} (throttle)`,
        );
      }

      return jsonResponse({ tracked: true, notified: !throttled });
    }

    return jsonResponse({ tracked: true });
  } catch (err) {
    console.error("track-quote-view error:", err);
    return errorResponse("Internal server error", 500);
  }
});
