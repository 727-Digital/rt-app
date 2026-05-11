import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient } from "../_shared/supabase.ts";

// One-shot cleanup function — deletes debug rows from the messages table
// that were created during the Signal House webhook diagnosis.
// Safe: targets only debug-marked rows, scoped to specific lead.

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Simple shared-secret guard so this can't be triggered by random callers.
  const secret = req.headers.get("x-cleanup-secret");
  const expected = Deno.env.get("CLEANUP_SECRET") || "rt-cleanup-2026";
  if (secret !== expected) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = getServiceClient();
  const TY_HANSON_LEAD_ID = "7b41e6d1-5fd4-44a1-b7d2-c8872f292df6";

  // Count first
  const { count: beforeCount } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("lead_id", TY_HANSON_LEAD_ID)
    .or("body.ilike.[DEBUG:%,from_number.eq.DEBUG");

  // Delete debug rows
  const { error, count } = await supabase
    .from("messages")
    .delete({ count: "exact" })
    .eq("lead_id", TY_HANSON_LEAD_ID)
    .or("body.ilike.[DEBUG:%,from_number.eq.DEBUG");

  if (error) {
    console.error("[cleanup] delete error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, matchedBefore: beforeCount, deleted: count }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
