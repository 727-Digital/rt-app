// One-off diagnostic. Calls Signal House directly with the configured
// credentials and returns the full raw response. Lets us see whether the API
// is silently dropping messages, throttling, or accepting them as expected.
//
// Now also probes possible "list my phone numbers" endpoints so we can
// figure out whether we can auto-pull available numbers into the CRM.
//
// Delete after debugging is complete.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sendSmsDetailed } from "../_shared/signalhouse.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { resolveOutboundNumber } from "../_shared/numbers.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
      },
    });
  }

  const token = Deno.env.get("SIGNALHOUSE_API_TOKEN");
  const from = Deno.env.get("SIGNALHOUSE_FROM_NUMBER");
  const base = Deno.env.get("SIGNALHOUSE_API_BASE") || "https://v2.signalhouse.io";

  const env = {
    hasToken: !!token,
    tokenPrefix: token ? token.slice(0, 16) + "..." : null,
    from,
    base,
    APP_URL: Deno.env.get("APP_URL") || "(unset)",
    SUPABASE_URL: Deno.env.get("SUPABASE_URL"),
  };

  const url = new URL(req.url);

  // ?verify=routing&to=... — exercises the full resolver pipeline (lookup
  // Reliable Turf org → resolveOutboundNumber → use returned number as
  // 'from' on the actual send). Sends ONLY to the supplied recipient. No
  // team fan-out, no lead row created.
  if (url.searchParams.get("verify") === "routing") {
    const to = url.searchParams.get("to") ?? "8505824588";
    const supabase = getServiceClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("id, slug")
      .eq("slug", "reliable-turf")
      .maybeSingle();
    if (!org) {
      return new Response(JSON.stringify({ error: "no reliable-turf org" }));
    }
    const orgId = (org as { id: string }).id;
    // Simulate the unassigned-lead case (no rep), which is what an intake
    // SMS would resolve to under the current single-rep config.
    const fromNumber = await resolveOutboundNumber(supabase, {
      orgId,
      assignedTeamMemberId: null,
    });
    const body =
      `Routing test: org default resolver returned ${fromNumber}. ` +
      `If this lands from (678) 434-0360, the new per-rep system is live.`;
    const result = await sendSmsDetailed(to, body, fromNumber);
    return new Response(JSON.stringify({
      orgId,
      resolvedFrom: fromNumber,
      to,
      body,
      sendResult: result,
    }, null, 2), { headers: { "Content-Type": "application/json" } });
  }

  // ?probe=numbers — try every reasonable endpoint name for "list phone
  // numbers I own at Signal House" until one returns 200. Helps us decide
  // whether auto-pull is feasible without reading docs.
  if (url.searchParams.get("probe") === "numbers") {
    if (!token) return new Response(JSON.stringify({ error: "no token" }));
    const candidates = [
      "/phone-numbers",
      "/numbers",
      "/sender-phone-numbers",
      "/senders",
      "/account/phone-numbers",
      "/v1/phone-numbers",
      "/v2/phone-numbers",
      "/v2/numbers",
      "/v2/sender-numbers",
      "/v2/inventory",
      "/sender",
      "/v2/sender",
      "/v2/messaging-services",
      "/v2/brands",
      "/v2/campaigns",
      "/message/sms",
      "/v2/account",
      "/v2/me",
      "/account",
      "/me",
      "/brand",
      "/v2/brand",
      "/campaign",
      "/v2/campaign",
    ];
    const attempts: Array<{ url: string; status: number; sample: unknown }> = [];
    for (const path of candidates) {
      try {
        const r = await fetch(`${base}${path}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let body: unknown = null;
        try {
          body = await r.json();
        } catch {
          body = await r.text();
        }
        const sample = typeof body === "string"
          ? (body as string).slice(0, 200)
          : JSON.stringify(body).slice(0, 400);
        attempts.push({ url: `${base}${path}`, status: r.status, sample });
      } catch (e) {
        attempts.push({ url: `${base}${path}`, status: 0, sample: String(e) });
      }
    }
    return new Response(
      JSON.stringify({ base, attempts }, null, 2),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // GET ?lookup=<messageId>  → fetch final delivery status.
  if (req.method === "GET") {
    const messageId = url.searchParams.get("lookup");
    if (!messageId) {
      return new Response(JSON.stringify({ env, error: "missing ?lookup=<id>" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    const candidates = [
      `${base}/message/sms/${messageId}`,
      `${base}/messages/${messageId}`,
      `${base}/message/${messageId}`,
    ];
    const attempts: Array<{ url: string; status: number; body: unknown }> = [];
    for (const u of candidates) {
      try {
        const r = await fetch(u, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let parsed: unknown = null;
        try { parsed = await r.json(); } catch { parsed = await r.text(); }
        attempts.push({ url: u, status: r.status, body: parsed });
        if (r.ok) break;
      } catch (e) {
        attempts.push({ url: u, status: 0, body: String(e) });
      }
    }
    return new Response(JSON.stringify({ env, messageId, attempts }, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  }

  let to = "8505824588";
  let body = "Diagnostic ping " + new Date().toISOString().slice(11, 19);
  try {
    const json = await req.json();
    if (json.to) to = String(json.to);
    if (json.body) body = String(json.body);
  } catch {
    // no body provided, use defaults
  }

  const result = await sendSmsDetailed(to, body);

  return new Response(
    JSON.stringify(
      {
        env,
        request: { to, body, bodyLength: body.length },
        result,
      },
      null,
      2,
    ),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
});
