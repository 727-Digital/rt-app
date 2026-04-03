import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendConversionEvent } from "../_shared/facebook.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { event_name, lead_id, value, currency } = await req.json();

    if (!event_name || !lead_id) {
      return errorResponse("event_name and lead_id are required");
    }

    const supabase = getServiceClient();

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadErr || !lead) {
      console.error("Lead not found:", leadErr);
      return errorResponse("Lead not found", 404);
    }

    const nameParts = (lead.name || "").split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    const zipMatch = (lead.address || "").match(/\b(\d{5})(?:-\d{4})?\b/);
    const zip = zipMatch ? zipMatch[1] : undefined;

    const eventId = `${lead_id}_${event_name}`;
    const eventTime = Math.floor(Date.now() / 1000);

    const customData: Record<string, unknown> = {};
    if (event_name === "Purchase" && value) {
      customData.value = value;
      customData.currency = currency || "USD";
    }

    const success = await sendConversionEvent({
      event_name,
      event_time: eventTime,
      event_id: eventId,
      user_data: {
        email: lead.email || undefined,
        phone: lead.phone || undefined,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        zip: zip || undefined,
      },
      custom_data: Object.keys(customData).length > 0 ? customData : undefined,
    });

    await supabase.from("fb_conversion_events").insert({
      lead_id,
      event_name,
      event_id: eventId,
      fb_response: { success },
      status: success ? "sent" : "failed",
    });

    if (event_name === "Purchase") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      try {
        await fetch(`${supabaseUrl}/functions/v1/fb-audience-sync`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "add_customer", lead_id }),
        });
      } catch (err) {
        console.error("Failed to trigger audience sync:", err);
      }
    }

    console.log(`CAPI ${event_name} event for lead ${lead_id}: ${success ? "sent" : "failed"}`);

    return jsonResponse({
      success,
      event_name,
      event_id: eventId,
      lead_id,
    });
  } catch (err) {
    console.error("fb-conversion error:", err);
    return errorResponse("Internal server error", 500);
  }
});
