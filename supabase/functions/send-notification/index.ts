import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendSms } from "../_shared/signalhouse.ts";
import { sendEmail } from "../_shared/resend.ts";
import { sendApnsPush, type ApnsPayload } from "../_shared/apns.ts";
import { getOrgBranding, brandedEmailHtml, type OrgBranding } from "../_shared/branding.ts";

interface NotificationRequest {
  lead_id: string;
  quote_id?: string;
  org_id?: string;
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

// Format any phone string into "(xxx) xxx-xxxx" for readable display. Handles
// raw digits, +1 prefix, already-formatted, and 11-digit US numbers.
function formatPhone(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { lead_id, quote_id, type, org_id: requestOrgId } =
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

    const orgId = requestOrgId || lead.org_id;
    let org: OrgBranding | null = null;
    if (orgId) {
      try {
        org = await getOrgBranding(supabase, orgId);
      } catch (e) {
        console.error("Failed to fetch org branding:", e);
      }
    }

    const orgName = org?.name || "Reliable Turf";

    let quote = null;
    if (quote_id) {
      const { data } = await supabase
        .from("quotes")
        .select("*")
        .eq("id", quote_id)
        .single();
      quote = data;
    }

    // Targeted fan-out: if the lead is assigned to a specific rep, only that
    // rep gets the alert. Unassigned leads fan out to every team_member of
    // the org so somebody picks it up. This is the core of "ZIP -> rep
    // routes the lead end-to-end".
    const assignedRepId = (lead as { assigned_team_member_id?: string | null })
      .assigned_team_member_id;

    let teamMembersQuery = supabase
      .from("team_members")
      .select("*")
      .eq("org_id", orgId);
    if (assignedRepId) {
      teamMembersQuery = teamMembersQuery.eq("id", assignedRepId);
    }
    const { data: teamMembers } = await teamMembersQuery;

    if (!teamMembers?.length) {
      return jsonResponse({ message: "No team members to notify", sent: 0 });
    }

    const smsBody = buildSmsBody(type, lead, quote, appUrl, orgName);
    const { subject: emailSubject, html: emailHtml } = buildEmailContent(
      type,
      lead,
      quote,
      appUrl,
      org,
    );
    const pushPayload = buildPushPayload(type, lead, quote, orgName);

    let sent = 0;
    let pushSent = 0;

    // Pull every active device_token for this org once — we'll fan out APNs
    // pushes per device. Push is opt-in via the iOS permission prompt, so the
    // presence of a token implies the user wants in-app notifications.
    const { data: deviceTokens } = await supabase
      .from("device_tokens")
      .select("token, user_id, platform")
      .eq("org_id", orgId)
      .eq("is_active", true);

    for (const member of teamMembers) {
      if (member.notify_sms && member.phone) {
        const ok = await sendSms(member.phone, smsBody);
        if (ok) {
          await logNotification(supabase, {
            lead_id,
            quote_id: quote_id || null,
            org_id: orgId,
            channel: "sms",
            type,
            recipient: member.phone,
            body: smsBody,
          });
          sent++;
        }
      }

      if (member.notify_email && member.email) {
        // Reply-To is the lead's email when known — recipient can reply
        // straight to the customer from their inbox, and inbox providers
        // treat reply-able mail as more legitimate.
        const leadEmail = lead.email as string | null | undefined;
        const ok = await sendEmail(member.email, emailSubject, emailHtml, {
          replyTo: leadEmail || undefined,
        });
        if (ok) {
          await logNotification(supabase, {
            lead_id,
            quote_id: quote_id || null,
            org_id: orgId,
            channel: "email",
            type,
            recipient: member.email,
            subject: emailSubject,
            body: emailHtml,
          });
          sent++;
        }
      }

      // APNs push — fire to every device this user has registered. Skip if no
      // tokens exist (user hasn't opened the iOS app or denied permission).
      const memberTokens = (deviceTokens || []).filter(
        (t) => t.user_id === member.user_id && t.platform === "ios",
      );
      for (const t of memberTokens) {
        try {
          const result = await sendApnsPush(t.token, pushPayload);
          if (result.status === 200) {
            await logNotification(supabase, {
              lead_id,
              quote_id: quote_id || null,
              org_id: orgId,
              channel: "push",
              type,
              recipient: t.token.slice(0, 12) + "...",
              body: pushPayload.body,
            });
            pushSent++;
            sent++;
          } else if (
            result.status === 410 ||
            result.reason === "BadDeviceToken" ||
            result.reason === "Unregistered"
          ) {
            // Device uninstalled the app or token was rotated — mark inactive
            // so we stop trying. iOS will issue a fresh token next launch.
            await supabase
              .from("device_tokens")
              .update({ is_active: false })
              .eq("token", t.token);
            console.warn(
              `[send-notification] retired device token (${result.status} ${result.reason}):`,
              t.token.slice(0, 12) + "...",
            );
          } else {
            console.error(
              `[send-notification] APNs push failed:`,
              result.status,
              result.reason,
            );
          }
        } catch (e) {
          console.error("[send-notification] APNs push threw:", e);
        }
      }
    }

    return jsonResponse({
      message: "Notifications sent",
      sent,
      pushSent,
    });
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
  orgName: string,
): string {
  const name = lead.name as string;
  const address = lead.address as string;
  const sqft = lead.sqft as number;
  const id = lead.id as string;

  switch (type) {
    case "new_lead": {
      const phone = formatPhone(lead.phone as string);
      const area = sqft ? `${sqft.toLocaleString()} sq ft` : "(not provided)";
      // SMS body intentionally contains NO URLs. Verizon's 10DLC spam filter
      // silently drops messages from this campaign that contain any
      // unshortened app.reliableturf.com link (confirmed 2026-05-11). The
      // push notification fires alongside the SMS and deep-links to the
      // lead detail page, so the View link is redundant. Email still has
      // the link.
      return [
        "You have a new lead:",
        `Name: ${name}`,
        `Cell #: ${phone}`,
        `Address: ${address}`,
        `Area: ${area}`,
      ].join("\n");
    }
    case "quote_viewed":
      return `\u{1F440} ${name} just viewed their ${orgName} quote! (${quote ? formatCurrency(quote.total as number) : "N/A"})`;
    case "quote_approved":
      return `\u{1F389} ${name} approved their ${orgName} quote! (${quote ? formatCurrency(quote.total as number) : "N/A"}) Time to schedule install.`;
    default:
      return `[${orgName}] Notification for ${name}`;
  }
}

function buildPushPayload(
  type: string,
  lead: Record<string, unknown>,
  quote: Record<string, unknown> | null,
  orgName: string,
): ApnsPayload {
  const name = lead.name as string;
  const sqft = lead.sqft as number | undefined;
  const id = lead.id as string;
  const quoteId = (quote?.id as string | undefined) ?? "";

  // data fields land on the notification object — the iOS app reads lead_id /
  // quote_id and deep-links to the right route on tap (see usePushNotifications).
  const data: Record<string, string> = { lead_id: id };
  if (quoteId) data.quote_id = quoteId;

  switch (type) {
    case "new_lead":
      return {
        title: "\u{1F3E0} New lead",
        body: sqft
          ? `${name} — ${sqft.toLocaleString()} sq ft, est. ${formatEstimateRange(lead.estimate_min as number, lead.estimate_max as number)}`
          : `${name} just submitted a request`,
        data,
      };
    case "quote_viewed":
      return {
        title: "\u{1F440} Quote viewed",
        body: `${name} just opened their ${orgName} quote${quote ? ` (${formatCurrency(quote.total as number)})` : ""}`,
        data,
      };
    case "quote_approved":
      return {
        title: "\u{1F389} Quote approved",
        body: `${name} approved their quote${quote ? ` (${formatCurrency(quote.total as number)})` : ""} — schedule install`,
        data,
      };
    default:
      return { title: orgName, body: `Update for ${name}`, data };
  }
}

function buildEmailContent(
  type: string,
  lead: Record<string, unknown>,
  quote: Record<string, unknown> | null,
  appUrl: string,
  org: OrgBranding | null,
): { subject: string; html: string } {
  const name = lead.name as string;
  const id = lead.id as string;
  const leadUrl = `${appUrl}/leads/${id}`;
  const orgName = org?.name || "Reliable Turf";
  const color = org?.primary_color || "#16a34a";

  if (org) {
    switch (type) {
      case "new_lead": {
        const subject = `New lead from ${name}`;
        const satelliteUrl = lead.satellite_image_url as string | null;
        const satelliteImg = satelliteUrl
          ? `<div style="margin:0 0 20px;"><img src="${satelliteUrl}" alt="Traced yard area" style="display:block;width:100%;max-width:560px;height:auto;border-radius:8px;border:1px solid #e5e7eb;" /></div>`
          : "";
        const html = brandedEmailHtml(
          org,
          "New Lead Received",
          `${satelliteImg}<table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;color:#6b7280;">Name</td><td style="padding:8px 0;font-weight:600;">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Address</td><td style="padding:8px 0;">${lead.address}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Phone</td><td style="padding:8px 0;">${lead.phone}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;">${lead.email}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Sq Ft</td><td style="padding:8px 0;">${(lead.sqft as number).toLocaleString()}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Estimate</td><td style="padding:8px 0;">${formatEstimateRange(lead.estimate_min as number, lead.estimate_max as number)}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280;">Source</td><td style="padding:8px 0;">${lead.source}</td></tr>
          </table>`,
          leadUrl,
          "View Lead",
        );
        return { subject, html };
      }
      case "quote_viewed": {
        const subject = `${name} just viewed their quote`;
        const total = quote ? formatCurrency(quote.total as number) : "N/A";
        const html = brandedEmailHtml(
          org,
          "Quote Viewed",
          `<p><strong>${name}</strong> just opened their quote.</p>
           <p style="font-size:24px;font-weight:700;color:${color};">${total}</p>
           <p style="color:#6b7280;">Now might be a good time to follow up.</p>`,
          leadUrl,
          "View Lead",
        );
        return { subject, html };
      }
      case "quote_approved": {
        const subject = `${name} approved their quote`;
        const total = quote ? formatCurrency(quote.total as number) : "N/A";
        const html = brandedEmailHtml(
          org,
          "Quote Approved!",
          `<p><strong>${name}</strong> approved their quote.</p>
           <p style="font-size:24px;font-weight:700;color:${color};">${total}</p>
           <p style="color:#6b7280;">Time to schedule the installation.</p>`,
          leadUrl,
          "View Lead",
        );
        return { subject, html };
      }
      default: {
        const subject = `Update on ${name}`;
        const html = brandedEmailHtml(
          org,
          "Notification",
          `<p>Update for lead ${name}.</p>`,
          leadUrl,
          "View Lead",
        );
        return { subject, html };
      }
    }
  }

  // Fallback if no org branding available (legacy behavior)
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
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:1.5;">
      <p style="margin:0 0 4px;">You're receiving this because you're a team member at Reliable Turf and have lead notifications enabled.</p>
      <p style="margin:0 0 4px;">Reliable Turf &middot; Gulf Breeze, FL</p>
      <p style="margin:0;"><a href="mailto:unsubscribe@reliableturf.com?subject=Unsubscribe" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a> &middot; <a href="${appUrl}/settings" style="color:#9ca3af;text-decoration:underline;">Notification settings</a></p>
    </div>
  </div>
</body>
</html>`;

  switch (type) {
    case "new_lead": {
      const subject = `New lead from ${name}`;
      const satelliteUrl = lead.satellite_image_url as string | null;
      const satelliteImg = satelliteUrl
        ? `<div style="margin:0 0 20px;"><img src="${satelliteUrl}" alt="Traced yard area" style="display:block;width:100%;max-width:560px;height:auto;border-radius:8px;border:1px solid #e5e7eb;" /></div>`
        : "";
      const html = wrapper(
        "New Lead Received",
        `${satelliteImg}<table style="width:100%;border-collapse:collapse;">
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
      const subject = `${name} just viewed their quote`;
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
      const subject = `${name} approved their quote`;
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
      const subject = `Update on ${name}`;
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
    org_id: string | null;
    channel: "sms" | "email" | "push";
    type: string;
    recipient: string;
    subject?: string;
    body?: string;
  },
) {
  // The production notifications table has:
  //   - org_id NOT NULL  → must always be passed
  //   - channel enum     → no "push" value, so skip logging push rows here
  // Without these guards every insert was silently 22P02-ing for over a
  // month and the audit table was effectively dead. Discovered via the
  // lead-peek diagnostic 2026-05-11.
  if (data.channel === "push") return;
  if (!data.org_id) {
    console.warn("[logNotification] skip: org_id required");
    return;
  }
  const { error } = await supabase.from("notifications").insert({
    lead_id: data.lead_id,
    quote_id: data.quote_id,
    org_id: data.org_id,
    channel: data.channel,
    type: data.type,
    recipient: data.recipient,
    subject: data.subject || null,
    body: data.body || null,
    sent_at: new Date().toISOString(),
  });
  if (error) console.error("Failed to log notification:", error);
}
