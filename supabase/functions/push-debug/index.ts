import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// In-memory ring buffer of the most recent push-debug events. Survives within
// a single function instance (Deno isolate). Good enough for a 10-min debug
// window — Supabase function logs are the durable record.
const recent: Array<{ stage: string; info?: unknown; ts: string }> = [];
const MAX = 50;

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify(recent.slice(-MAX), null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  try {
    const body = await req.json();
    recent.push({ stage: body.stage, info: body.info, ts: body.ts || new Date().toISOString() });
    if (recent.length > MAX) recent.splice(0, recent.length - MAX);
    console.log("[push-debug]", JSON.stringify(body));
  } catch (e) {
    console.error("[push-debug] parse error:", e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
