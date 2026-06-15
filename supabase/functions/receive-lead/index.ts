import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendSms } from "../_shared/signalhouse.ts";
import { resolveOutboundNumber } from "../_shared/numbers.ts";
import { fetchMessengerProfile } from "../_shared/messenger.ts";

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

  // Look up the org name so the very first message the customer
  // receives mentions the company they actually filled out a form for.
  // Pro Green South customers shouldn't see a generic "team member"
  // message that could be from anyone.
  let orgName: string | null = null;
  if (orgId) {
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();
    orgName = (orgRow as { name?: string } | null)?.name || null;
  }
  const teamReference = orgName
    ? `A ${orgName} team member`
    : "A team member";
  const body =
    `Hi ${first}, thanks for your turf request! ${teamReference} will be in touch shortly to schedule your free consultation.`;
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

// Look up an explicit Lead Form → org/rep mapping. FB Lead Forms carry no
// address, so this is how leads get assigned to the right rep on arrival.
// Returns null when the form isn't mapped (caller falls back to ZIP/default).
async function resolveFormRoute(
  supabase: ReturnType<typeof getServiceClient>,
  formId: string | undefined,
): Promise<{ orgId: string; teamMemberId: string | null } | null> {
  if (!formId) return null;
  const { data } = await supabase
    .from("fb_lead_form_routes")
    .select("org_id, team_member_id")
    .eq("fb_form_id", formId)
    .maybeSingle();
  const row = data as { org_id?: string; team_member_id?: string | null } | null;
  if (row?.org_id) {
    return { orgId: row.org_id, teamMemberId: row.team_member_id ?? null };
  }
  return null;
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

        // Route by Lead Form first (form_id is in the webhook payload). If
        // the form is mapped in fb_lead_form_routes, the lead lands with
        // the right org + rep on arrival. Otherwise fall back to the
        // ZIP/territory routing (and ultimately the default org).
        const formRoute = await resolveFormRoute(supabase, change.value.form_id);
        const { orgId, teamMemberId } = formRoute ??
          await resolveRouting(supabase, address);

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
            fb_leadgen_id: leadgenId,
          })
          .select("id")
          .single();

        if (error || !lead) {
          console.error("Failed to insert FB lead:", error);
          continue;
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        // Use the anon key to satisfy the Functions gateway. The
        // service-role key is now the sb_secret_ format, which the
        // gateway rejects as an invalid bearer (401) — that silently
        // killed every internal notification/CAPI call. The target
        // functions are verify_jwt=false and use their own service
        // client internally, so the anon bearer is all they need.
        const gatewayKey = Deno.env.get("SUPABASE_ANON_KEY")!;

        try {
          await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${gatewayKey}`,
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
              Authorization: `Bearer ${gatewayKey}`,
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

// Messenger DMs to the Page. Same Page webhook subscription as leadgen
// — Meta multiplexes both into one POST stream. Each entry has either
// `changes` (leadgen) or `messaging` (DM events). We file each DM as an
// inbound message and create a `source: 'messenger'` lead the first
// time we see a given PSID.
async function handleMessengerEvents(payload: Record<string, unknown>): Promise<Response> {
  const supabase = getServiceClient();
  const entries = (payload.entry as Array<Record<string, unknown>>) ?? [];

  for (const entry of entries) {
    const pageId = String(entry.id ?? "");
    const messaging = entry.messaging as
      | Array<{
        sender?: { id?: string };
        recipient?: { id?: string };
        message?: { mid?: string; text?: string; is_echo?: boolean };
        timestamp?: number;
      }>
      | undefined;
    if (!messaging || messaging.length === 0) continue;

    // Resolve which org owns this Page. Without a mapping we drop the
    // event — better than filing DMs into the wrong tenant.
    const { data: orgRow } = await supabase
      .from("organizations")
      .select("id")
      .eq("fb_page_id", pageId)
      .maybeSingle();
    const orgId = (orgRow as { id?: string } | null)?.id;
    if (!orgId) {
      console.warn(`[receive-lead] no org mapped to fb_page_id=${pageId}, skipping ${messaging.length} event(s)`);
      continue;
    }

    for (const event of messaging) {
      // Page echoes (admin replies sent via FB Page Inbox or another
      // app) come back as messaging events with is_echo=true. We could
      // store these but for now we only ingest customer-to-page DMs to
      // avoid the chicken-and-egg of recording our own outbound twice.
      if (event.message?.is_echo) continue;
      const psid = event.sender?.id;
      const text = event.message?.text;
      if (!psid || !text) continue;

      // Find-or-create the lead by PSID. UNIQUE index on leads.fb_psid
      // makes the dedup atomic, but we read-first so we can keep the
      // existing assigned_team_member_id intact for repeat DMs.
      let leadId: string | null = null;
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("fb_psid", psid)
        .maybeSingle();
      if (existing) {
        leadId = (existing as { id: string }).id;
      } else {
        const profile = await fetchMessengerProfile(psid);
        const fullName = profile?.name
          ?? [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim()
          ?? "";
        const displayName = fullName || "Messenger Lead";

        const { data: created, error: createErr } = await supabase
          .from("leads")
          .insert({
            name: displayName,
            email: "",
            phone: "",
            address: "",
            sqft: 0,
            estimate_min: 0,
            estimate_max: 0,
            status: "new_lead",
            source: "messenger",
            org_id: orgId,
            fb_psid: psid,
          })
          .select("id")
          .single();
        if (createErr || !created) {
          console.error(`[receive-lead] failed to create messenger lead for psid ${psid}:`, createErr);
          continue;
        }
        leadId = (created as { id: string }).id;

        // Fire the same new-lead notification path leadgen uses — so
        // admins + assigned rep (if any) get email/push the moment a
        // DM lands.
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          // Use the anon key to satisfy the Functions gateway. The
        // service-role key is now the sb_secret_ format, which the
        // gateway rejects as an invalid bearer (401) — that silently
        // killed every internal notification/CAPI call. The target
        // functions are verify_jwt=false and use their own service
        // client internally, so the anon bearer is all they need.
        const gatewayKey = Deno.env.get("SUPABASE_ANON_KEY")!;
          await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${gatewayKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ lead_id: leadId, type: "new_lead", org_id: orgId }),
          });
        } catch (notifyErr) {
          console.error("[receive-lead] failed to trigger notification for messenger lead:", notifyErr);
        }
      }

      // Dedup inbound message by Meta's mid before insert. mid is
      // stable per-message; Meta will retry POSTs if we don't ack 200.
      if (event.message?.mid) {
        const { data: dupe } = await supabase
          .from("messages")
          .select("id")
          .eq("twilio_sid", event.message.mid)
          .maybeSingle();
        if (dupe) continue;
      }

      await supabase.from("messages").insert({
        lead_id: leadId,
        org_id: orgId,
        direction: "inbound",
        channel: "messenger",
        from_number: psid, // generic identifier column; channel disambiguates
        to_number: pageId,
        body: text,
        twilio_sid: event.message?.mid ?? null,
        status: "received",
      });
    }
  }

  return jsonResponse({ status: "received" }, 200);
}

// Constant-time string compare to avoid timing side-channels when
// checking the webhook signature.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function computeHmacHex(
  rawBody: string,
  appSecret: string,
  hash: "SHA-256" | "SHA-1",
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawBody),
  );
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Verify Meta's webhook signature against the raw request body using the
// app secret. Meta signs each POST with the app secret as
// `sha256=<hmac>` (X-Hub-Signature-256) and, for backward compatibility,
// `sha1=<hmac>` (X-Hub-Signature). We accept either. See audit C2.
async function verifyFacebookSignature(
  rawBody: string,
  sig256: string | null,
  sig1: string | null,
  appSecret: string,
): Promise<boolean> {
  if (sig256 && sig256.startsWith("sha256=")) {
    const provided = sig256.slice("sha256=".length).trim().toLowerCase();
    const computed = await computeHmacHex(rawBody, appSecret, "SHA-256");
    if (timingSafeEqual(computed, provided)) return true;
  }
  if (sig1 && sig1.startsWith("sha1=")) {
    const provided = sig1.slice("sha1=".length).trim().toLowerCase();
    const computed = await computeHmacHex(rawBody, appSecret, "SHA-1");
    if (timingSafeEqual(computed, provided)) return true;
  }
  return false;
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
    // Read the raw body first — we need the exact bytes to verify the
    // Facebook HMAC signature before trusting any of it.
    const rawBody = await req.text();
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(rawBody);
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    // Detect Facebook Page webhook (leadgen OR messenger). We branch by
    // whether the entries carry `changes` (leadgen) or `messaging` (DM).
    if (raw.object === "page" && raw.entry) {
      // SECURITY (audit C2): verify Meta's signature. The endpoint is
      // public, so a forged payload could inject fake leads / trigger
      // real SMS.
      //
      // MONITOR MODE (TEMPORARY — 2026-05-28): a prior fail-closed deploy
      // was silently 403-ing Meta's real webhooks and dropping LIVE leads
      // (confirmed: zero leads captured for ~2 days). Until the exact
      // signing mismatch is diagnosed from these logs, we verify-and-log
      // but DO NOT reject — losing real, paid-for leads is worse than the
      // theoretical forgery risk. Re-enable fail-closed once the log
      // below shows which signature scheme/secret Meta actually uses.
      const appSecret = Deno.env.get("FB_APP_SECRET");
      const sig256 = req.headers.get("x-hub-signature-256");
      const sig1 = req.headers.get("x-hub-signature");
      let sigValid = false;
      if (appSecret) {
        sigValid = await verifyFacebookSignature(rawBody, sig256, sig1, appSecret);
      }
      if (!sigValid) {
        // Diagnostic: what did Meta actually send? Prefixes only (safe).
        let dbg256: string | null = null;
        let dbg1: string | null = null;
        if (appSecret) {
          dbg256 = (await computeHmacHex(rawBody, appSecret, "SHA-256")).slice(0, 16);
          dbg1 = (await computeHmacHex(rawBody, appSecret, "SHA-1")).slice(0, 16);
        }
        console.warn(
          "[receive-lead] FB signature NOT verified — processing anyway (MONITOR MODE). " +
            JSON.stringify({
              hasSecret: !!appSecret,
              provided256: sig256 ?? null,
              provided1: sig1 ?? null,
              computed256Prefix: dbg256,
              computed1Prefix: dbg1,
              bodyLen: rawBody.length,
            }),
        );
      } else {
        console.log("[receive-lead] FB signature verified OK");
      }

      const firstEntry = (raw.entry as Array<Record<string, unknown>>)[0] ?? {};
      const hasMessaging = Array.isArray(firstEntry.messaging) && firstEntry.messaging.length > 0;
      if (hasMessaging) return await handleMessengerEvents(raw);
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
    // anon key satisfies the Functions gateway; the service-role key is
    // now sb_secret_ format which the gateway 401s. Target is
    // verify_jwt=false and uses its own service client internally.
    const gatewayKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gatewayKey}`,
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
