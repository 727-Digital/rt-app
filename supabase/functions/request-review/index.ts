import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendSms } from "../_shared/twilio.ts";
import { sendEmail } from "../_shared/resend.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { lead_id } = await req.json();
    if (!lead_id) return errorResponse("lead_id is required");

    const supabase = getServiceClient();
    const googleReviewUrl =
      Deno.env.get("GOOGLE_REVIEW_URL") || "https://g.page/r/reliableturf/review";
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

    const smsBody = `Hi ${lead.name}! Thanks for choosing Reliable Turf! \u{1F33F} We'd love your feedback. Leave us a Google review: ${landingUrl}`;

    const emailSubject = "How was your Reliable Turf experience?";
    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px;background:#f5f5f5;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#16a34a;margin:0;">Reliable Turf</h1>
    </div>

    <p>Hi ${lead.name},</p>

    <p>Thank you for choosing Reliable Turf for your artificial turf installation! We hope you're enjoying your new yard.</p>

    <p>We'd really appreciate it if you could take a moment to share your experience with a Google review. Your feedback helps other homeowners find us and helps us keep improving.</p>

    <div style="text-align:center;margin:32px 0;">
      <a href="${landingUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:16px 40px;border-radius:6px;font-weight:600;font-size:18px;">Leave a Review</a>
    </div>

    <p style="color:#6b7280;">Thank you for your time!</p>
    <p style="color:#6b7280;">- The Reliable Turf Team</p>

    <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;">Reliable Turf &bull; Gulf Breeze, FL</p>
  </div>
</body>
</html>`;

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
      await sendEmail(lead.email, emailSubject, emailHtml);
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
