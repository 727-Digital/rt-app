// One-off diagnostic. Calls Signal House directly with the configured
// credentials and returns the full raw response. Lets us see whether the API
// is silently dropping messages, throttling, or accepting them as expected.
//
// Usage:
//   curl -X POST .../sms-diagnostic -H 'apikey: <anon>' -H 'Authorization: Bearer <anon>' \
//        -H 'Content-Type: application/json' -d '{"to":"8505824588","body":"hi"}'
//
// Delete after debugging is complete.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sendSmsDetailed } from "../_shared/signalhouse.ts";

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
  };

  // GET ?lookup=<messageId>  → fetch final delivery status from Signal House.
  // Tries a few likely endpoint shapes since the API docs are imperfect.
  if (req.method === "GET") {
    const url = new URL(req.url);
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
