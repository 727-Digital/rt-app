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
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return errorResponse("Invalid token", 401);

    const { zip_codes } = await req.json();
    if (!Array.isArray(zip_codes) || zip_codes.length === 0) {
      return errorResponse("At least one zip code is required");
    }

    const validZips = zip_codes.filter((z: string) => /^\d{5}$/.test(z));
    if (validZips.length === 0) {
      return errorResponse("No valid 5-digit zip codes provided");
    }

    const serviceClient = getServiceClient();

    const pendingOrgId = user.user_metadata?.pending_org_id;
    const pendingName = user.user_metadata?.pending_name;
    let orgId: string;

    if (pendingOrgId) {
      const { data: existingOrg } = await serviceClient
        .from("organizations")
        .select("id")
        .eq("id", pendingOrgId)
        .single();

      if (existingOrg) {
        orgId = existingOrg.id;
      } else {
        const { data: newOrg, error: orgErr } = await serviceClient
          .from("organizations")
          .insert({
            name: pendingName || user.email?.split("@")[0] || "New Company",
            slug: (pendingName || user.email?.split("@")[0] || "company")
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, ""),
            email: user.email,
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
        orgId = newOrg.id;
      }
    } else {
      const companyName = user.user_metadata?.company_name ||
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "New Company";

      const slug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const { data: newOrg, error: orgErr } = await serviceClient
        .from("organizations")
        .insert({
          name: companyName,
          slug,
          email: user.email,
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
      orgId = newOrg.id;
    }

    const userName = user.user_metadata?.full_name ||
      user.email?.split("@")[0] ||
      "Admin";

    const { error: memberErr } = await serviceClient
      .from("team_members")
      .insert({
        org_id: orgId,
        user_id: user.id,
        name: userName,
        email: user.email,
        role: "admin",
        notify_sms: true,
        notify_email: true,
      });

    if (memberErr) {
      if (memberErr.code === "23505") {
        console.log("Team member already exists, skipping");
      } else {
        console.error("Failed to create team member:", memberErr);
        return errorResponse("Failed to create team member", 500);
      }
    }

    const { error: territoryErr } = await serviceClient
      .from("territories")
      .insert({
        org_id: orgId,
        name: "Service Area",
        zip_codes: validZips,
        is_active: true,
      });

    if (territoryErr) {
      console.error("Failed to create territory:", territoryErr);
    }

    await serviceClient
      .from("organizations")
      .update({ onboarding_complete: true })
      .eq("id", orgId);

    console.log(`Onboarding complete: user=${user.id}, org=${orgId}, zips=${validZips.join(",")}`);

    return jsonResponse({ org_id: orgId, status: "complete" });
  } catch (err) {
    console.error("complete-onboarding error:", err);
    return errorResponse("Internal server error", 500);
  }
});
