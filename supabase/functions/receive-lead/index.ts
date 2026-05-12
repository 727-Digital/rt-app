import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendSms } from "../_shared/signalhouse.ts";
import { resolveOutboundNumber } from "../_shared/numbers.ts";

// Friendly first name from a "First Last" string. Fallback: the whole string.
function firstNameOf(full: string): string {
  return (full || "").trim().split(/\s+/)[0] || "there";
}

// Sends an immediate "thanks, we got your request" SMS to the customer and
// writes a corresponding row in the messages table so the rep sees it in the
// lead's thread. Errors are swallowed; the lead intake itself never fails
// because of an SMS hiccup.
async function sendCustomerIntakeSms(
  supabase: ReturnType<typeof getServiceClient>,
  leadId: string,
  orgId: string | null,
  assignedTeamMemberId: string | null,
  toNumber: string,
  customerName: string,
) {
  const first = firstNameOf(customerName);
  const body =
    `Hi ${first}, thanks for your turf request! A team member will be in touch shortly to schedule your free consultation.`;
  try {
    // Use the assigned rep's number when known, else the org default,
    // else the global env-var fallback.
    const from = await resolveOutboundNumber(supabase, {
      leadId,
      orgId,
      assignedTeamMemberId,
    });
    const ok = await sendSms(toNumber, body, from);
    await supabase.from("messages").insert({
      lead_id: leadId,
      org_id: orgId,
      direction: "outbound",
      channel: "sms",
      from_number: from ?? null,
      to_number: toNumber,
      body,
      status: ok ? "queued" : "failed",
    });
  } catch (e) {
    console.error("[receive-lead] customer intake SMS failed:", e);
  }
}

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

interface RoutingResult {
  orgId: string;
  teamMemberId: string | null;
}

async function resolveRouting(
  supabase: ReturnType<typeof getServiceClient>,
  address: string,
  explicitOrgId?: string,
): Promise<RoutingResult> {
  // Explicit org_id from the request body (rare; some integrations pass it).
  // Skips territory lookup so no rep auto-assignment happens.
  if (explicitOrgId) return { orgId: explicitOrgId, teamMemberId: null };

  const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) {
    const zip = zipMatch[1];
    // Prefer the most specific territory: a rep-bound row for this ZIP wins
    // over an org-only fallback. We sort team_member_id DESC NULLS LAST so
    // rep-bound rows come first.
    const { data: territories } = await supabase
      .from("territories")
      .select("org_id, team_member_id")
      .contains("zip_codes", [zip])
      .eq("is_active", true)
      .order("team_member_id", { ascending: false, nullsFirst: false })
      .limit(1);

    const territory = (territories ?? [])[0] as
      | { org_id: string; team_member_id: string | null }
      | undefined;
    if (territory?.org_id) {
      return { orgId: territory.org_id, teamMemberId: territory.team_member_id ?? null };
    }
  }

  // Last-ditch fallback: the default 'reliable-turf' org, no rep.
  const { data: fallback } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "reliable-turf")
    .single();

  if (!fallback) throw new Error("No default organization found");
  return { orgId: fallback.id as string, teamMemberId: null };
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

        const { orgId, teamMemberId } = await resolveRouting(supabase, address);

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
            assigned_team_member_id: teamMemberId,
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

        // Customer-facing intake SMS, same flow as the website path.
        if (phone) {
          await sendCustomerIntakeSms(
            supabase,
            lead.id,
            orgId,
            teamMemberId,
            phone,
            name,
          );
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

    // Lovable's quote form uses different field names than the original CRM
    // contract — accept both shapes so either side can evolve independently.
    // Lovable sends: turf_polygon (raw lat/lng points) +
    // turf_polygon_geojson (closed GeoJSON Polygon). Prefer geojson when
    // present since it's the richer/canonical shape.
    const polygonData =
      raw.polygon_data ?? raw.turf_polygon_geojson ?? raw.turf_polygon;
    const body: LeadPayload = {
      name: raw.name || raw.customer_name,
      email: raw.email || raw.customer_email,
      phone: raw.phone || raw.customer_phone,
      address: raw.address,
      sqft: raw.sqft || raw.turf_area_sqft,
      estimate_min: raw.estimate_min ?? raw.estimated_price ?? 0,
      estimate_max: raw.estimate_max ?? raw.estimated_price ?? 0,
      polygon_data: polygonData,
      // Lovable's crm-forward-lead edge function names this satellite_map_url;
      // keep both aliases working.
      satellite_image_url: raw.satellite_image_url ?? raw.satellite_map_url,
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

    const { orgId, teamMemberId } = await resolveRouting(
      supabase,
      body.address,
      body.org_id,
    );

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
        assigned_team_member_id: teamMemberId,
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

    // Customer-facing "thanks, we got it" SMS. Logged into the lead's
    // message thread too so the rep can see what the customer received.
    if (body.phone) {
      await sendCustomerIntakeSms(
        supabase,
        lead.id,
        orgId,
        teamMemberId,
        body.phone,
        body.name,
      );
    }

    return jsonResponse({ id: lead.id, org_id: orgId, status: "created" }, 201);
  } catch (err) {
    console.error("receive-lead error:", err);
    return errorResponse("Internal server error", 500);
  }
});
