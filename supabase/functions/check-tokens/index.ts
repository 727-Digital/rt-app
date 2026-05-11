import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient } from "../_shared/supabase.ts";

Deno.serve(async () => {
  const supabase = getServiceClient();
  const { data, error, count } = await supabase
    .from("device_tokens")
    .select("user_id, platform, is_active, created_at, updated_at, token", { count: "exact" });
  return new Response(JSON.stringify({ count, error: error?.message, data }, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
});
