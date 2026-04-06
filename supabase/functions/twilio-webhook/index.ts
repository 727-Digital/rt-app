import { getServiceClient } from "../_shared/supabase.ts";

// Twilio sends webhook as application/x-www-form-urlencoded
Deno.serve(async (req: Request) => {
  // Twilio sends POST for incoming messages
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await req.formData();
    const from = formData.get("From") as string; // customer's phone
    const to = formData.get("To") as string; // our Twilio number
    const body = formData.get("Body") as string;
    const twilioSid = formData.get("MessageSid") as string;

    if (!from || !body) {
      console.error("Missing From or Body in Twilio webhook");
      return twimlResponse("");
    }

    console.log(`Inbound SMS from ${from}: ${body.substring(0, 50)}...`);

    const supabase = getServiceClient();

    // Normalize phone: strip everything except digits, ensure +1 prefix
    const digits = from.replace(/\D/g, "");
    const normalized = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
    // Also try the raw digits without country code for matching
    const localDigits = digits.startsWith("1") ? digits.slice(1) : digits;

    // Find the lead by phone number — try multiple formats
    const { data: lead } = await supabase
      .from("leads")
      .select("id, org_id, phone")
      .or(
        `phone.eq.${from},phone.eq.${normalized},phone.ilike.%${localDigits}`
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!lead) {
      console.warn(`No lead found for phone: ${from} (normalized: ${normalized})`);
      // Still return 200 so Twilio doesn't retry
      return twimlResponse("");
    }

    // Insert inbound message record
    const { error: insertError } = await supabase.from("messages").insert({
      lead_id: lead.id,
      org_id: lead.org_id,
      direction: "inbound",
      channel: "sms",
      from_number: from,
      to_number: to,
      body: body,
      twilio_sid: twilioSid,
      status: "received",
    });

    if (insertError) {
      console.error("Failed to insert inbound message:", insertError);
    }

    // Return empty TwiML — we don't auto-reply
    return twimlResponse("");
  } catch (err) {
    console.error("twilio-webhook error:", err);
    return twimlResponse("");
  }
});

function twimlResponse(message: string): Response {
  const xml = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
