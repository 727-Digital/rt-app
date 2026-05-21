// Invite a new team member: creates the auth.users record (or adopts an
// existing orphan), generates a magic invite/recovery link via the admin
// API, and delivers a branded email through Resend. Insert the
// team_members row linked to the user.
//
// Why generateLink + Resend instead of inviteUserByEmail?
//   inviteUserByEmail uses Supabase's built-in mailer which has poor
//   deliverability (especially to Yahoo) and is rate-limited to 4/hour.
//   Resend is already wired up project-wide via _shared/resend.ts and
//   delivers reliably with the same Reliable Turf branded sender.
//
// Caller must be admin or platform_admin. Same authz model as
// admin-set-user-password.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendEmail } from "../_shared/resend.ts";

interface InvitePayload {
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  org_id: string;
}

function inviteEmailHtml(name: string, actionLink: string): string {
  // Inline-styled HTML for maximum email-client compatibility. Tables for
  // layout because Outlook / Apple Mail still treat flex / grid poorly.
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8fafc;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="background-color:#16a34a;padding:32px 24px;text-align:center;">
        <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.025em;">Reliable Turf</h1>
      </td></tr>
      <tr><td style="padding:32px 32px 8px 32px;">
        <h2 style="margin:0 0 16px 0;color:#0f172a;font-size:20px;font-weight:600;">Welcome to the team, ${escapeHtml(name.split(/\s+/)[0] || "there")}</h2>
        <p style="margin:0 0 24px 0;color:#475569;font-size:15px;line-height:1.6;">
          You've been invited to join Reliable Turf. Click the button below to set your password and start working leads.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background-color:#16a34a;border-radius:8px;">
            <a href="${actionLink}" style="display:inline-block;padding:14px 28px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;">Set Your Password</a>
          </td></tr>
        </table>
        <p style="margin:24px 0 0 0;color:#64748b;font-size:13px;line-height:1.6;">
          Or paste this link into your browser:<br>
          <span style="color:#16a34a;word-break:break-all;">${actionLink}</span>
        </p>
      </td></tr>
      <tr><td style="padding:24px 32px;border-top:1px solid #e2e8f0;background-color:#f8fafc;">
        <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;text-align:center;">
          If you weren't expecting this invitation, you can safely ignore this email.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

    // Refuse outright duplicate team_members rows in this org.
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

    const siteUrl =
      Deno.env.get("APP_SITE_URL") || "https://app.reliableturf.com";
    const redirectTo = `${siteUrl}/reset-password`;

    // Detect a pre-existing auth user with this email. Pagination upper
    // bound is fine for the foreseeable future (sub-1000 users).
    let existingAuthUserId: string | null = null;
    try {
      const { data: listed } = await service.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      const match = listed?.users?.find(
        (u) => u.email?.toLowerCase() === email,
      );
      if (match) existingAuthUserId = match.id;
    } catch (e) {
      console.warn("admin.listUsers lookup failed:", e);
    }

    // Cross-org guard.
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
    let actionLink: string;

    if (existingAuthUserId) {
      // Orphan auth user — refresh metadata and generate a recovery link.
      userId = existingAuthUserId;
      await service.auth.admin
        .updateUserById(userId, {
          user_metadata: { name, role, org_id: orgId },
        })
        .catch((e) => console.warn("updateUserById on orphan failed:", e));

      const { data: link, error: linkErr } = await service.auth.admin
        .generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });
      if (linkErr || !link?.properties?.action_link) {
        console.error("generateLink(recovery) failed:", linkErr);
        return errorResponse(
          `Failed to generate recovery link: ${linkErr?.message ?? "unknown"}`,
          500,
        );
      }
      actionLink = link.properties.action_link;
    } else {
      // Brand-new user: generateLink with type=invite creates the auth
      // user AND returns the magic link in one call.
      const { data: link, error: linkErr } = await service.auth.admin
        .generateLink({
          type: "invite",
          email,
          options: {
            data: { name, role, org_id: orgId },
            redirectTo,
          },
        });
      if (linkErr || !link?.user || !link?.properties?.action_link) {
        console.error("generateLink(invite) failed:", linkErr);
        return errorResponse(
          `Failed to create invite: ${linkErr?.message ?? "unknown"}`,
          500,
        );
      }
      userId = link.user.id;
      actionLink = link.properties.action_link;
    }

    // Send the branded invite email via Resend.
    const emailSent = await sendEmail(
      email,
      "You've been invited to Reliable Turf",
      inviteEmailHtml(name, actionLink),
    );

    if (!emailSent) {
      console.error("Resend send returned false for", email);
      // Don't abort — auth user + team_members row are still valid. An
      // admin can resend later. Surface a warning to the UI.
      // Fall through to insert team_members below.
    }

    // Insert team_members row linked to the auth user.
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
      // Only nuke the auth user if we created it in this same call.
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
      email_sent: emailSent,
    });
  } catch (err) {
    console.error("invite-team-member error:", err);
    return errorResponse("Internal server error", 500);
  }
});
