import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendEmail } from "../_shared/resend.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Missing authorization", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return errorResponse("Invalid token", 401);

    const serviceClient = getServiceClient();

    // Verify caller is a platform_admin
    const { data: callerMember } = await serviceClient
      .from("team_members")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["platform_admin", "admin"])
      .limit(1)
      .single();

    if (!callerMember) return errorResponse("Unauthorized: admin access required", 403);

    const { application_id } = await req.json();
    if (!application_id) return errorResponse("application_id is required");

    // Fetch the pending application
    const { data: app, error: appErr } = await serviceClient
      .from("rep_applications")
      .select("*")
      .eq("id", application_id)
      .single();

    if (appErr || !app) return errorResponse("Application not found", 404);
    if (app.status !== "pending") return errorResponse("Application is not pending");

    // Create an auth user for the rep with a temporary password
    const tempPassword = `RT-${crypto.randomUUID().slice(0, 8)}`;
    const { data: authData, error: createUserErr } = await serviceClient.auth.admin.createUser({
      email: app.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: app.name,
        company_name: app.company_name,
      },
    });

    if (createUserErr || !authData.user) {
      console.error("Failed to create auth user:", createUserErr);
      return errorResponse("Failed to create user account", 500);
    }

    const newUserId = authData.user.id;

    // Create organization for the rep's company
    const slug = app.company_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data: newOrg, error: orgErr } = await serviceClient
      .from("organizations")
      .insert({
        name: app.company_name,
        slug,
        email: app.email,
        phone: app.phone,
        primary_color: "#16a34a",
        pricing_min: 10,
        pricing_max: 12.25,
        payment_methods: ["check", "zelle"],
        onboarding_complete: true,
      })
      .select("id")
      .single();

    if (orgErr || !newOrg) {
      console.error("Failed to create org:", orgErr);
      return errorResponse("Failed to create organization", 500);
    }

    // Create team_member record
    const { error: memberErr } = await serviceClient
      .from("team_members")
      .insert({
        org_id: newOrg.id,
        user_id: newUserId,
        name: app.name,
        email: app.email,
        role: "sales",
        notify_sms: true,
        notify_email: true,
      });

    if (memberErr) {
      console.error("Failed to create team member:", memberErr);
      return errorResponse("Failed to create team member", 500);
    }

    // Update application status
    await serviceClient
      .from("rep_applications")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", application_id);

    // Send welcome email with temporary password
    await sendEmail(
      app.email,
      "Welcome to Reliable Turf!",
      `<h2>Your application has been approved!</h2>
      <p>Hi ${app.name},</p>
      <p>Your Reliable Turf account is ready. Here are your login credentials:</p>
      <p><strong>Email:</strong> ${app.email}<br/>
      <strong>Temporary Password:</strong> ${tempPassword}</p>
      <p>Please log in at <a href="https://app.reliableturf.com">app.reliableturf.com</a> and change your password.</p>
      <p>Welcome aboard!</p>`,
    );

    console.log(`Application approved: app=${application_id}, user=${newUserId}, org=${newOrg.id}`);

    return jsonResponse({
      status: "approved",
      user_id: newUserId,
      org_id: newOrg.id,
    });
  } catch (err) {
    console.error("approve-rep-application error:", err);
    return errorResponse("Internal server error", 500);
  }
});
