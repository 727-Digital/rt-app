import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient } from "../_shared/supabase.ts";

// Lead Sync Watchdog reconciler.
//
// Pulls every recent lead from FB Lead Center (Graph API), confirms each
// is present in the Reliable Turf app, and SILENTLY ingests any the
// webhook missed — no intake SMS, no notification fan-out, pure data
// recovery. Records per-lead sync state in fb_lead_sync for the in-app
// "Lead Sync" card.
//
// Triggered by pg_cron every ~15 min (and on-demand for the card refresh).
// Gated by RECONCILE_SECRET so it isn't a public endpoint.

const GRAPH = "https://graph.facebook.com/v21.0";
const RT_PAGE_ID = "1004538636077014";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // Auth gate — internal/cron only.
  const expected = Deno.env.get("RECONCILE_SECRET");
  const provided =
    req.headers.get("x-reconcile-token") ||
    new URL(req.url).searchParams.get("token") ||
    "";
  if (!expected || provided !== expected) {
    return new Response("Forbidden", { status: 403 });
  }

  const token = Deno.env.get("FB_PAGE_ACCESS_TOKEN");
  if (!token) return json({ error: "FB_PAGE_ACCESS_TOKEN not configured" }, 500);

  const supabase = getServiceClient();

  // Default org fallback for any form without an explicit route.
  const { data: defaultOrgRow } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", "reliable-turf")
    .maybeSingle();
  const defaultOrgId = (defaultOrgRow as { id?: string } | null)?.id ?? null;

  // 1. List the page's lead forms.
  const formsRes = await fetch(
    `${GRAPH}/${RT_PAGE_ID}/leadgen_forms?fields=id,name&limit=100&access_token=${token}`,
  );
  const formsJson = await formsRes.json();
  if (formsJson.error) {
    return json({ error: "forms fetch failed", detail: formsJson.error }, 502);
  }
  const forms = (formsJson.data ?? []) as Array<{ id: string; name: string }>;

  let checked = 0;
  let recovered = 0;

  for (const form of forms) {
    // Resolve this form's routing once.
    const { data: routeRow } = await supabase
      .from("fb_lead_form_routes")
      .select("org_id, team_member_id")
      .eq("fb_form_id", form.id)
      .maybeSingle();
    const route = routeRow as
      | { org_id?: string; team_member_id?: string | null }
      | null;

    // 2. Pull recent leads on this form.
    const leadsRes = await fetch(
      `${GRAPH}/${form.id}/leads?fields=id,created_time,field_data&limit=100&access_token=${token}`,
    );
    const leadsJson = await leadsRes.json();
    if (leadsJson.error) continue;
    const fbLeads = (leadsJson.data ?? []) as Array<{
      id: string;
      created_time: string;
      field_data?: Array<{ name: string; values?: string[] }>;
    }>;

    const cutoffMs = Date.now() - 3 * 24 * 60 * 60 * 1000; // last 3 days

    for (const fb of fbLeads) {
      // Only reconcile recent leads — old ones are already handled and
      // re-scanning all history every 15 min is wasteful.
      if (fb.created_time && new Date(fb.created_time).getTime() < cutoffMs) {
        continue;
      }

      const fields: Record<string, string> = {};
      for (const fd of fb.field_data ?? []) {
        fields[fd.name.toLowerCase()] = fd.values?.[0] || "";
      }
      const name = fields.full_name || fields.name || "";
      const email = fields.email || "";
      const phone = fields.phone_number || fields.phone || "";

      // Skip Meta's dummy test-tool leads so they never get recreated.
      if (email === "test@meta.com" || name.startsWith("<test lead")) {
        continue;
      }
      checked++;

      // Already in the app? Match by leadgen_id first (exact).
      const { data: byLeadgen } = await supabase
        .from("leads")
        .select("id, org_id, fb_leadgen_id")
        .eq("fb_leadgen_id", fb.id)
        .maybeSingle();
      let existingLead = byLeadgen as
        | { id?: string; org_id?: string; fb_leadgen_id?: string | null }
        | null;

      // Fallback: a manually-added lead, or the Messenger auto-copy, won't
      // carry the leadgen_id — match those by phone (last 10 digits) or
      // email so we don't create a duplicate. Then stamp the leadgen_id so
      // future runs match exactly.
      if (!existingLead) {
        const digits = (phone || "").replace(/\D/g, "");
        if (digits.length >= 10) {
          const { data: byPhone } = await supabase
            .from("leads")
            .select("id, org_id, fb_leadgen_id")
            .ilike("phone", `%${digits.slice(-10)}%`)
            .order("created_at", { ascending: false })
            .limit(1);
          if (byPhone && byPhone.length) existingLead = byPhone[0];
        }
        if (!existingLead && email) {
          const { data: byEmail } = await supabase
            .from("leads")
            .select("id, org_id, fb_leadgen_id")
            .ilike("email", email)
            .order("created_at", { ascending: false })
            .limit(1);
          if (byEmail && byEmail.length) existingLead = byEmail[0];
        }
        if (existingLead && !existingLead.fb_leadgen_id && existingLead.id) {
          await supabase
            .from("leads")
            .update({ fb_leadgen_id: fb.id })
            .eq("id", existingLead.id);
        }
      }

      let appLeadId = existingLead?.id ?? null;
      let inApp = !!existingLead;
      let orgId = existingLead?.org_id ?? route?.org_id ?? defaultOrgId;
      let didRecover = false;

      if (!existingLead) {
        // SILENT recovery — insert the lead row ONLY. No intake SMS, no
        // send-notification fan-out. The rep works it from the app.
        const insertOrg = route?.org_id ?? defaultOrgId;
        const { data: newLead } = await supabase
          .from("leads")
          .insert({
            name,
            email,
            phone,
            address: "",
            sqft: 0,
            estimate_min: 0,
            estimate_max: 0,
            status: "new_lead",
            source: "facebook",
            org_id: insertOrg,
            assigned_team_member_id: route?.team_member_id ?? null,
            fb_leadgen_id: fb.id,
            notes: "Recovered by Lead Sync watchdog (webhook miss).",
          })
          .select("id")
          .single();
        appLeadId = (newLead as { id?: string } | null)?.id ?? null;
        inApp = !!appLeadId;
        didRecover = !!appLeadId;
        orgId = insertOrg;
        if (appLeadId) recovered++;
      }

      // Preserve a prior recovered=true (it's a historical fact).
      const { data: priorSync } = await supabase
        .from("fb_lead_sync")
        .select("recovered")
        .eq("leadgen_id", fb.id)
        .maybeSingle();
      const recoveredFlag =
        didRecover || ((priorSync as { recovered?: boolean } | null)?.recovered ?? false);

      await supabase.from("fb_lead_sync").upsert(
        {
          leadgen_id: fb.id,
          form_id: form.id,
          lead_name: name,
          lead_phone: phone,
          fb_created_time: fb.created_time,
          org_id: orgId,
          app_lead_id: appLeadId,
          in_app: inApp,
          recovered: recoveredFlag,
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: "leadgen_id" },
      );
    }
  }

  return json({ ok: true, forms: forms.length, checked, recovered });
});
