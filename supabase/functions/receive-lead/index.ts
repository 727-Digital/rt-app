import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

interface LeadPayload {
  name: string;
  email: string;
  phone: string;
  address: string;
  sqft: number;
  estimate_min: number;
  estimate_max: number;
  polygon_data?: unknown;
  satellite_image_url?: string;
  org_id?: string;
}

const REQUIRED_FIELDS: (keyof LeadPayload)[] = [
  "name",
  "email",
  "phone",
  "address",
  "sqft",
  "estimate_min",
  "estimate_max",
];

async function resolveOrgId(
  supabase: ReturnType<typeof getServiceClient>,
  address: string,
  explicitOrgId?: string,
): Promise<string> {
  if (explicitOrgId) return explicitOrgId;

  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) {
    const zip = zipMatch[1];
    const { data: territory } = await supabase
      .from("territories")
      .select("org_id")
      .contains("zip_codes", [zip])
      .eq("is_active", true)
      .limit(1)
      .single();

    if (territory?.org_id) return territory.org_id;
  }

  const { data: fallback } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "reliable-turf")
    .single();

  if (!fallback) throw new Error("No default organization found");
  return fallback.id;
}

async function handleFacebookLeadgen(payload: Record<string, unknown>): Promise<Response> {
  const fbAccessToken = Deno.env.get("FB_PAGE_ACCESS_TOKEN");
  if (!fbAccessToken) {
    console.error("FB_PAGE_ACCESS_TOKEN not configured");
    return jsonResponse({ status: "received" }, 200);
  }

  const supabase = getServiceClient();
  const entries = payload.entry as Array<Record<string, unknown>>;

  for (const entry of entries) {
    const changes = entry.changes as Array<{ field: string; value: Record<string, string> }>;
    if (!changes) continue;

    for (const change of changes) {
      if (change.field !== "leadgen") continue;

      const leadgenId = change.value.leadgen_id;
      if (!leadgenId) continue;

      try {
        const res = await fetch(
          `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${fbAccessToken}`,
        );
        const leadData = await res.json();

        if (leadData.error) {
          console.error("FB Graph API error:", leadData.error);
          continue;
        }

        const fields: Record<string, string> = {};
        for (const fd of leadData.field_data || []) {
          fields[fd.name.toLowerCase()] = fd.values?.[0] || "";
        }

        const name = fields.full_name || fields.name || "";
        const email = fields.email || "";
        const phone = fields.phone_number || fields.phone || "";
        const address = fields.street_address || fields.address || fields.city || "";
        const sqft = parseFloat(fields.sqft || fields.square_footage || fields.turf_area || "0");

        const orgId = await resolveOrgId(supabase, address);

        const { data: lead, error } = await supabase
          .from("leads")
          .insert({
            name,
            email,
            phone,
            address,
            sqft: sqft || 0,
            estimate_min: 0,
            estimate_max: 0,
            status: "new_lead",
            source: "facebook",
            org_id: orgId,
          })
          .select("id")
          .single();

        if (error || !lead) {
          console.error("Failed to insert FB lead:", error);
          continue;
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        try {
          await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ lead_id: lead.id, type: "new_lead", org_id: orgId }),
          });
        } catch (notifyErr) {
          console.error("Failed to trigger notification for FB lead:", notifyErr);
        }

        try {
          await fetch(`${supabaseUrl}/functions/v1/fb-conversion`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ event_name: "Lead", lead_id: lead.id }),
          });
        } catch (capiErr) {
          console.error("Failed to trigger CAPI Lead event:", capiErr);
        }

        console.log(`FB lead created: ${lead.id} from leadgen ${leadgenId}`);
      } catch (err) {
        console.error(`Error processing leadgen ${leadgenId}:`, err);
      }
    }
  }

  return jsonResponse({ status: "received" }, 200);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  // Facebook webhook verification (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("FB_VERIFY_TOKEN");

    if (mode === "subscribe" && token === verifyToken) {
      return new Response(challenge, { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const raw = await req.json();

    // Detect Facebook Lead Ads webhook
    if (raw.object === "page" && raw.entry) {
      return await handleFacebookLeadgen(raw);
    }

    // Website webhook (existing flow)
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET");
    if (webhookSecret) {
      const provided = req.headers.get("x-webhook-secret");
      if (provided !== webhookSecret) {
        return errorResponse("Invalid webhook secret", 401);
      }
    }

    const body: LeadPayload = {
      name: raw.name || raw.customer_name,
      email: raw.email || raw.customer_email,
      phone: raw.phone || raw.customer_phone,
      address: raw.address,
      sqft: raw.sqft || raw.turf_area_sqft,
      estimate_min: raw.estimate_min ?? raw.estimated_price ?? 0,
      estimate_max: raw.estimate_max ?? raw.estimated_price ?? 0,
      polygon_data: raw.polygon_data,
      satellite_image_url: raw.satellite_image_url,
      org_id: raw.org_id,
    };

    const missing = REQUIRED_FIELDS.filter(
      (f) => body[f] === undefined || body[f] === null || body[f] === "",
    );
    if (missing.length > 0) {
      return errorResponse(`Missing required fields: ${missing.join(", ")}`);
    }

    if (typeof body.sqft !== "number" || body.sqft <= 0) {
      return errorResponse("sqft must be a positive number");
    }

    const supabase = getServiceClient();

    const orgId = await resolveOrgId(supabase, body.address, body.org_id);

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        name: body.name,
        email: body.email,
        phone: body.phone,
        address: body.address,
        sqft: body.sqft,
        estimate_min: body.estimate_min,
        estimate_max: body.estimate_max,
        polygon_data: body.polygon_data || null,
        satellite_image_url: body.satellite_image_url || null,
        status: "new_lead",
        source: "website",
        org_id: orgId,
      })
      .select("id")
      .single();

    if (error || !lead) {
      console.error("Failed to insert lead:", error);
      return errorResponse("Failed to create lead", 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lead_id: lead.id, type: "new_lead", org_id: orgId }),
      });
    } catch (notifyErr) {
      console.error("Failed to trigger notification:", notifyErr);
    }

    if (body.phone) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "lead_confirmation",
            channel: "sms",
            recipient: body.phone,
            lead_id: lead.id,
            lead_name: body.name,
          }),
        });
      } catch (confirmErr) {
        console.error("Failed to send customer confirmation SMS:", confirmErr);
      }
    }

    return jsonResponse({ id: lead.id, org_id: orgId, status: "created" }, 201);
  } catch (err) {
    console.error("receive-lead error:", err);
    return errorResponse("Internal server error", 500);
  }
});
