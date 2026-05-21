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

    // Refuse outright duplicate team_members rows in this org. (We still
    // allow taking over an orphan auth user — handled below.)
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

    // Resolve redirect URL for the invite/recovery link. The web app
    // handles the hash-based recovery session in /reset-password.
    const siteUrl =
      Deno.env.get("APP_SITE_URL") || "https://app.reliableturf.com";
    const redirectTo = `${siteUrl}/reset-password`;

    // Detect a pre-existing auth user with this email (leftover test
    // account, prior signup that never finished onboarding, etc.).
    // Supabase doesn't expose a public "find by email" endpoint, so we
    // scan via admin.listUsers — fine at our scale (5 users today). If
    // the project grows, switch this to the new admin.getUserByEmail
    // helper once it ships in supabase-js.
    let existingAuthUserId: string | null = null;
    try {
      // perPage 200 covers us for the foreseeable future at this org's
      // scale; revisit only if we cross that boundary.
      const { data: listed } = await service.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const match = listed?.users?.find(
        (u) => u.email?.toLowerCase() === email,
      );
      if (match) existingAuthUserId = match.id;
    } catch (e) {
      // If the lookup itself fails, fall through to inviteUserByEmail
      // and let it surface the real error.
      console.warn("admin.listUsers lookup failed, falling through:", e);
    }

    // Cross-org guard: if the email already belongs to a team_members
    // row in a DIFFERENT org, refuse.
    if (existingAuthUserId) {
      const { data: otherOrgTm } = await service
        .from("team_members")
        .select("id, org_id")
        .eq("user_id", existingAuthUserId)
        .maybeSingle();
      if (otherOrgTm) {
        return errorResponse(
          "That email is already a team member of another org",
          409,
        );
      }
    }

    let userId: string;
    if (existingAuthUserId) {
      // Take over the orphan auth user. Send a password recovery email
      // so they can set a fresh password (same UX as the invite flow).
      userId = existingAuthUserId;
      const { error: updateErr } = await service.auth.admin
        .updateUserById(userId, {
          user_metadata: { name, role, org_id: orgId },
        });
      if (updateErr) {
        console.error("updateUserById on orphan user failed:", updateErr);
      }
      const { error: recoveryErr } = await service.auth
        .resetPasswordForEmail(email, { redirectTo });
      if (recoveryErr) {
        console.error("resetPasswordForEmail failed:", recoveryErr);
        return errorResponse(
          `User already exists but reset email failed: ${recoveryErr.message}`,
          500,
        );
      }
    } else {
      // Brand-new user. Standard invite path.
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
      userId = invite.user.id;
    }

    // Insert team_members row linked to the auth user (new or existing).
    const { data: tmRow, error: insertErr } = await service
      .from("team_members")
      .insert({
        user_id: userId,
        name,
        email,
        phone,
        role,
        org_id: orgId,
      })
      .select("id, name, email, role")
      .single();

    if (insertErr || !tmRow) {
      console.error("team_members insert failed:", insertErr);
      // Only delete the auth user if we created it in this same call —
      // don't nuke a pre-existing user that we adopted.
      if (!existingAuthUserId) {
        await service.auth.admin.deleteUser(userId).catch(() => {});
      }
      return errorResponse(
        `Failed to create team member row: ${insertErr?.message ?? "unknown"}`,
        500,
      );
    }

    return jsonResponse({
      success: true,
      team_member: tmRow,
      user_id: userId,
      adopted_existing: !!existingAuthUserId,
    });
  } catch (err) {
    console.error("invite-team-member error:", err);
    return errorResponse("Internal server error", 500);
  }
});
