// Invite a new team member: creates the auth.users record, sends a
// Supabase-managed invite email (magic link → /reset-password where the
// rep sets their password), and inserts the team_members row linked to
// the new user_id. Atomic from the UI's perspective — if either step
// fails the function rolls back the other.
//
// Caller must be an admin or platform_admin. Same authz model as
// admin-set-user-password.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

interface InvitePayload {
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  org_id: string;
}

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

    const payload = (await req.json()) as Partial<InvitePayload>;
    const name = payload.name?.trim();
    const email = payload.email?.trim().toLowerCase();
    const phone = payload.phone?.trim() || null;
    const role = payload.role;
    const orgId = payload.org_id;

    if (!name) return errorResponse("name is required");
    if (!email) return errorResponse("email is required");
    if (!role) return errorResponse("role is required");
    if (!orgId) return errorResponse("org_id is required");

    const service = getServiceClient();

    // Authz: caller must be platform_admin OR admin of the same org.
    const { data: callerRow } = await service
      .from("team_members")
      .select("role, org_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const callerRole = (callerRow as { role?: string } | null)?.role ?? "";
    const callerOrgId = (callerRow as { org_id?: string } | null)?.org_id ?? null;

    const isPlatformAdmin =
      callerRole === "platform_admin" ||
      user.user_metadata?.is_platform_admin === true;
    const isOrgAdmin = callerRole === "admin" && callerOrgId === orgId;

    if (!isPlatformAdmin && !isOrgAdmin) {
      return errorResponse(
        `Not authorized — admin role required (you are: ${callerRole || "no team_members row"})`,
        403,
      );
    }

    // Refuse duplicates: if a team_members row already exists for this
    // email in this org, bail out so we don't create a duplicate.
    const { data: existingTm } = await service
      .from("team_members")
      .select("id")
      .eq("email", email)
      .eq("org_id", orgId)
      .maybeSingle();
    if (existingTm) {
      return errorResponse(
        "A team member with that email already exists in this org",
        409,
      );
    }

    // Resolve redirect URL for the invite link. The web app handles the
    // hash-based recovery session in /reset-password (where the rep can
    // set their password). Override with env var if needed.
    const siteUrl =
      Deno.env.get("APP_SITE_URL") || "https://app.reliableturf.com";
    const redirectTo = `${siteUrl}/reset-password`;

    // Step 1: invite. Supabase creates the auth.users row with no
    // password and emails the magic link. user_metadata.name is set so
    // we can re-derive the display name later if needed.
    const { data: invite, error: inviteErr } = await service.auth.admin
      .inviteUserByEmail(email, {
        data: { name, role, org_id: orgId },
        redirectTo,
      });

    if (inviteErr || !invite?.user) {
      console.error("inviteUserByEmail failed:", inviteErr);
      return errorResponse(
        `Failed to send invite: ${inviteErr?.message ?? "unknown"}`,
        500,
      );
    }

    const newUserId = invite.user.id;

    // Step 2: insert team_members row linked to the new auth user.
    const { data: tmRow, error: insertErr } = await service
      .from("team_members")
      .insert({
        user_id: newUserId,
        name,
        email,
        phone,
        role,
        org_id: orgId,
      })
      .select("id, name, email, role")
      .single();

    if (insertErr || !tmRow) {
      // Roll back the auth user so a retry can succeed instead of
      // erroring on the duplicate-email check above.
      console.error("team_members insert failed, rolling back auth user:", insertErr);
      await service.auth.admin.deleteUser(newUserId).catch(() => {});
      return errorResponse(
        `Failed to create team member row: ${insertErr?.message ?? "unknown"}`,
        500,
      );
    }

    return jsonResponse({
      success: true,
      team_member: tmRow,
      user_id: newUserId,
    });
  } catch (err) {
    console.error("invite-team-member error:", err);
    return errorResponse("Internal server error", 500);
  }
});
