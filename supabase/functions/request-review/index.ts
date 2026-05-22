import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendSms } from "../_shared/signalhouse.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getOrgBranding, brandedEmailHtml, type OrgBranding } from "../_shared/branding.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { lead_id } = await req.json();
    if (!lead_id) return errorResponse("lead_id is required");

    const supabase = getServiceClient();
    const siteUrl = Deno.env.get("SITE_URL") || "https://app.reliableturf.com";
    const landingUrl = `${siteUrl}/review/${lead_id}`;

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadErr || !lead) {
      return errorResponse("Lead not found", 404);
    }

    const orgId = lead.org_id;
    let org: OrgBranding | null = null;
    if (orgId) {
      try {
        org = await getOrgBranding(supabase, orgId);
      } catch (e) {
        console.error("Failed to fetch org branding:", e);
      }
    }

    const orgName = org?.name || "Reliable Turf";
    const googleReviewUrl = org?.google_review_url
      || Deno.env.get("GOOGLE_REVIEW_URL")
      || "https://g.page/r/reliableturf/review";

    const now = new Date().toISOString();

    const { data: review, error: reviewErr } = await supabase
      .from("reviews")
      .insert({
        lead_id,
        status: "sent",
        review_url: googleReviewUrl,
        sent_at: now,
      })
      .select("id")
      .single();

    if (reviewErr) {
      console.error("Failed to create review record:", reviewErr);
      return errorResponse("Failed to create review", 500);
    }

    const smsBody = `Hi ${lead.name}! Thanks for choosing ${orgName}! \u{1F33F} We'd love your feedback. Leave us a Google review: ${landingUrl}`;

    const emailSubject = `How was your ${orgName} experience?`;

    // Single render path — brandedEmailHtml pulls every brand-specific
    // element from the org row so the review email matches whichever
    // company actually did the install.
    const emailHtml = org
      ? brandedEmailHtml(
          org,
          "We'd Love Your Feedback",
          `<p>Hi ${lead.name},</p>
           <p>Thank you for choosing ${orgName} for your artificial turf installation! We hope you're enjoying your new yard.</p>
           <p>We'd really appreciate it if you could take a moment to share your experience with a Google review. Your feedback helps other homeowners find us and helps us keep improving.</p>
           <p style="color:#6b7280;">Thank you for your time!</p>
           <p style="color:#6b7280;">- The ${orgName} Team</p>`,
          landingUrl,
          "Leave a Review",
        )
      : `<!DOCTYPE html><html><body><h1>We'd Love Your Feedback</h1><p>Hi ${lead.name}, thanks for choosing us! <a href="${landingUrl}">Leave a review here.</a></p></body></html>`;

    if (lead.phone) {
      await sendSms(lead.phone, smsBody);
      await logNotification(supabase, {
        lead_id,
        channel: "sms",
        type: "review_requested",
        recipient: lead.phone,
        body: smsBody,
      });
    }

    if (lead.email) {
      await sendEmail(lead.email, emailSubject, emailHtml, { org });
      await logNotification(supabase, {
        lead_id,
        channel: "email",
        type: "review_requested",
        recipient: lead.email,
        subject: emailSubject,
        body: emailHtml,
      });
    }

    await supabase
      .from("leads")
      .update({ status: "review_requested" })
      .eq("id", lead_id);

    return jsonResponse({
      message: "Review request sent",
      review_id: review!.id,
      sms: !!lead.phone,
      email: !!lead.email,
    });
  } catch (err) {
    console.error("request-review error:", err);
    return errorResponse("Internal server error", 500);
  }
});

async function logNotification(
  supabase: ReturnType<typeof getServiceClient>,
  data: {
    lead_id: string;
    channel: "sms" | "email";
    type: string;
    recipient: string;
    subject?: string;
    body?: string;
  },
) {
  const { error } = await supabase.from("notifications").insert({
    lead_id: data.lead_id,
    quote_id: null,
    channel: data.channel,
    type: data.type,
    recipient: data.recipient,
    subject: data.subject || null,
    body: data.body || null,
    sent_at: new Date().toISOString(),
  });
  if (error) console.error("Failed to log notification:", error);
}
