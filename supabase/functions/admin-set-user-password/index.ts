// Admin-only password setter for team members. Calling user must be an
// admin of the same org as the target team member (or a platform admin).
// Uses supabase.auth.admin.updateUserById which requires the service role
// key — exposed safely behind the auth check below.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing authorization", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Identify the caller from their JWT.
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return errorResponse("Invalid token", 401);

    const { team_member_id, new_password } = await req.json();
    if (!team_member_id || typeof team_member_id !== "string") {
      return errorResponse("team_member_id is required");
    }
    if (!new_password || typeof new_password !== "string" || new_password.length < 8) {
      return errorResponse("Password must be at least 8 characters");
    }

    const service = getServiceClient();

    // Look up the target team_member.
    const { data: target, error: targetErr } = await service
      .from("team_members")
      .select("id, user_id, org_id, name")
      .eq("id", team_member_id)
      .maybeSingle();
    if (targetErr || !target) return errorResponse("Team member not found", 404);

    const targetTm = target as { id: string; user_id: string; org_id: string; name: string };

    // Caller must be an admin of the SAME org, or a platform admin
    // (cross-org). team_members.role can be one of:
    //   'sales'          → no admin powers
    //   'installer'      → no admin powers
    //   'admin'          → org admin, same-org actions only
    //   'platform_admin' → platform admin, can act across orgs
    const { data: callerTm } = await service
      .from("team_members")
      .select("id, org_id, role")
      .eq("user_id", user.id)
      .maybeSingle();

    const callerRole = (callerTm as { role?: string } | null)?.role ?? "";
    const callerOrgId = (callerTm as { org_id?: string } | null)?.org_id ?? null;

    const isPlatformAdmin =
      callerRole === "platform_admin" ||
      user.user_metadata?.is_platform_admin === true;
    const isOrgAdmin = callerRole === "admin" && callerOrgId === targetTm.org_id;

    if (!isPlatformAdmin && !isOrgAdmin) {
      return errorResponse(
        `Not authorized — admin role required (you are: ${callerRole || "no team_members row"})`,
        403,
      );
    }

    // Set the password via the Supabase admin API.
    const { error: updateErr } = await service.auth.admin.updateUserById(
      targetTm.user_id,
      { password: new_password },
    );
    if (updateErr) {
      console.error("admin.updateUserById failed:", updateErr);
      return errorResponse(`Failed to set password: ${updateErr.message}`, 500);
    }

    return jsonResponse({
      success: true,
      team_member: { id: targetTm.id, name: targetTm.name },
    });
  } catch (err) {
    console.error("admin-set-user-password error:", err);
    return errorResponse("Internal server error", 500);
  }
});
