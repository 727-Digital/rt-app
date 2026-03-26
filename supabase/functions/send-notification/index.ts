import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendSms } from "../_shared/twilio.ts";
import { sendEmail } from "../_shared/resend.ts";

interface NotificationRequest {
  lead_id: string;
  quote_id?: string;
  type: "new_lead" | "quote_viewed" | "quote_approved";
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(cents);
}

function formatEstimateRange(min: number, max: number): string {
  return `${formatCurrency(min)}-${formatCurrency(max)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { lead_id, quote_id, type } =
      (await req.json()) as NotificationRequest;

    if (!lead_id || !type) {
      return errorResponse("lead_id and type are required");
    }

    const supabase = getServiceClient();
    const appUrl = Deno.env.get("APP_URL") || "https://app.reliableturf.com";

    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();

    if (leadErr || !lead) {
      return errorResponse("Lead not found", 404);
    }

    let quote = null;
    if (quote_id) {
      const { data } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quote_id)
        .single();
      quote = data;
    }

    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("*");

    if (!teamMembers?.length) {
      return jsonResponse({ message: "No team members to notify", sent: 0 });
    }

    const smsBody = buildSmsBody(type, lead, quote, appUrl);
    const { subject: emailSubject, html: emailHtml } = buildEmailContent(
      type,
      lead,
      quote,
      appUrl,
    );

    let sent = 0;

    for (const member of teamMembers) {
      if (member.notify_sms && member.phone) {
        const ok = await sendSms(member.phone, smsBody);
        if (ok) {
          await logNotification(supabase, {
            lead_id,
            quote_id: quote_id || null,
            channel: "sms",
            type,
            recipient: member.phone,
            body: smsBody,
          });
          sent++;
        }
      }

      if (member.notify_email && member.email) {
        const ok = await sendEmail(member.email, emailSubject, emailHtml);
        if (ok) {
          await logNotification(supabase, {
            lead_id,
            quote_id: quote_id || null,
            channel: "email",
            type,
            recipient: member.email,
            subject: emailSubject,
            body: emailHtml,
          });
          sent++;
        }
      }
    }

    return jsonResponse({ message: "Notifications sent", sent });
  } catch (err) {
    console.error("send-notification error:", err);
    return errorResponse("Internal server error", 500);
  }
});

function buildSmsBody(
  type: string,
  lead: Record<string, unknown>,
  quote: Record<string, unknown> | null,
  appUrl: string,
): string {
  const name = lead.name as string;
  const address = lead.address as string;
  const sqft = lead.sqft as number;
  const id = lead.id as string;

  switch (type) {
    case "new_lead":
      return `\u{1F3E0} New lead! ${name} - ${address} (${sqft.toLocaleString()} sq ft, est. ${formatEstimateRange(lead.estimate_min as number, lead.estimate_max as number)}). View: ${appUrl}/leads/${id}`;
    case "quote_viewed":
      return `\u{1F440} ${name} just viewed their quote! (${quote ? formatCurrency(quote.total as number) : "N/A"})`;
    case "quote_approved":
      return `\u{1F389} ${name} approved their quote! (${quote ? formatCurrency(quote.total as number) : "N/A"}) Time to schedule install.`;
    default:
      return `Notification for ${name}`;
  }
}

function buildEmailContent(
  type: string,
  lead: Record<string, unknown>,
  quote: Record<string, unknown> | null,
  appUrl: string,
): { subject: string; html: string } {
  const name = lead.name as string;
  const id = lead.id as string;
  const leadUrl = `${appUrl}/leads/${id}`;

  const wrapper = (title: string, body: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px;background:#f5f5f5;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <h2 style="color:#16a34a;margin:0 0 16px;">${title}</h2>
    ${body}
    <div style="margin-top:24px;">
      <a href="${leadUrl}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">View Lead</a>
    </div>
    <p style="color:#9ca3af;font-size:12px;margin-top:32px;">Reliable Turf CRM</p>
  </div>
</body>
</html>`;

  switch (type) {
    case "new_lead": {
      const subject = `[Reliable Turf] New Lead: ${name}`;
      const html = wrapper(
        "New Lead Received",
        `<table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6b7280;">Name</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Address</td><td style="padding:8px 0;">${lead.address}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Phone</td><td style="padding:8px 0;">${lead.phone}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;">${lead.email}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Sq Ft</td><td style="padding:8px 0;">${(lead.sqft as number).toLocaleString()}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Estimate</td><td style="padding:8px 0;">${formatEstimateRange(lead.estimate_min as number, lead.estimate_max as number)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Source</td><td style="padding:8px 0;">${lead.source}</td></tr>
        </table>`,
      );
      return { subject, html };
    }
    case "quote_viewed": {
      const subject = `[Reliable Turf] Quote Viewed: ${name}`;
      const total = quote ? formatCurrency(quote.total as number) : "N/A";
      const html = wrapper(
        "Quote Viewed",
        `<p><strong>${name}</strong> just opened their quote.</p>
         <p style="font-size:24px;font-weight:700;color:#16a34a;">${total}</p>
         <p style="color:#6b7280;">Now might be a good time to follow up.</p>`,
      );
      return { subject, html };
    }
    case "quote_approved": {
      const subject = `[Reliable Turf] Quote Approved: ${name}`;
      const total = quote ? formatCurrency(quote.total as number) : "N/A";
      const html = wrapper(
        "Quote Approved!",
        `<p><strong>${name}</strong> approved their quote.</p>
         <p style="font-size:24px;font-weight:700;color:#16a34a;">${total}</p>
         <p style="color:#6b7280;">Time to schedule the installation.</p>`,
      );
      return { subject, html };
    }
    default: {
      const subject = `[Reliable Turf] Notification: ${name}`;
      const html = wrapper("Notification", `<p>Update for lead ${name}.</p>`);
      return { subject, html };
    }
  }
}

async function logNotification(
  supabase: ReturnType<typeof getServiceClient>,
  data: {
    lead_id: string;
    quote_id: string | null;
    channel: "sms" | "email";
    type: string;
    recipient: string;
    subject?: string;
    body?: string;
  },
) {
  const { error } = await supabase.from("notifications").insert({
    lead_id: data.lead_id,
    quote_id: data.quote_id,
    channel: data.channel,
    type: data.type,
    recipient: data.recipient,
    subject: data.subject || null,
    body: data.body || null,
    sent_at: new Date().toISOString(),
  });
  if (error) console.error("Failed to log notification:", error);
}
