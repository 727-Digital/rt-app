import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendSms } from "../_shared/signalhouse.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getOrgBranding, brandedEmailHtml, type OrgBranding } from "../_shared/branding.ts";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(amount);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { quote_id } = await req.json();
    if (!quote_id) return errorResponse("quote_id is required");

    const supabase = getServiceClient();
    const appUrl = Deno.env.get("APP_URL") || "https://app.reliableturf.com";

    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("*, lead:leads(*)")
      .eq("id", quote_id)
      .single();

    if (quoteErr || !quote) {
      return errorResponse("Quote not found", 404);
    }

    const lead = quote.lead;
    if (!lead) {
      return errorResponse("Lead not found for quote", 404);
    }

    const orgId = quote.org_id || lead.org_id;
    let org: OrgBranding | null = null;
    if (orgId) {
      try {
        org = await getOrgBranding(supabase, orgId);
      } catch (e) {
        console.error("Failed to fetch org branding:", e);
      }
    }

    const orgName = org?.name || "Reliable Turf";
    const color = org?.primary_color || "#16a34a";
    const quoteUrl = `${appUrl}/q/${quote_id}`;

    // First-name-only greeting reads like a human texting, not a bot.
    // ("Hi Cartee!" not "Hi Cartee Test!")
    const leadFirstName =
      ((lead.name as string) || "").trim().split(/\s+/)[0] || "there";
    const smsBody = `Hi ${leadFirstName}! Your turf installation quote from ${orgName} is ready. View it here: ${quoteUrl}`;

    const lineItemsHtml = (quote.line_items as Array<{ description: string; qty: number; unit_price: number; total: number }>)
      .map(
        (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${item.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${item.qty}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.unit_price)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatCurrency(item.total)}</td>
      </tr>`,
      )
      .join("");

    const quoteBodyHtml = `
    <p>Hi ${lead.name},</p>
    <p>Thanks for your interest in artificial turf! Here's a summary of your quote:</p>

    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px 12px;text-align:left;font-weight:600;">Item</th>
          <th style="padding:8px 12px;text-align:center;font-weight:600;">Qty</th>
          <th style="padding:8px 12px;text-align:right;font-weight:600;">Unit Price</th>
          <th style="padding:8px 12px;text-align:right;font-weight:600;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineItemsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3" style="padding:12px;text-align:right;font-weight:700;">Total</td>
          <td style="padding:12px;text-align:right;font-weight:700;font-size:18px;color:${color};">${formatCurrency(quote.total)}</td>
        </tr>
      </tfoot>
    </table>

    ${quote.valid_until ? `<p style="color:#6b7280;font-size:14px;">This quote is valid until ${new Date(quote.valid_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</p>` : ""}

    <p style="color:#6b7280;font-size:14px;">Questions? Just reply to this email or give us a call.</p>`;

    // Email body always renders via brandedEmailHtml so the logo,
    // header color, footer identity, and unsubscribe link all resolve
    // from the org row. No hardcoded Reliable Turf chrome leaking into
    // other brands' emails.
    const emailHtml = org
      ? brandedEmailHtml(
          org,
          "Your Quote is Ready",
          quoteBodyHtml,
          quoteUrl,
          "View Your Quote",
        )
      : // Hard-fallback for the (now extinct) case where an org row
        // can't be loaded. Keeps the email deliverable instead of
        // throwing, but signals the missing org in the body.
        `<!DOCTYPE html><html><body><h1>Your Quote is Ready</h1>${quoteBodyHtml}<p><a href="${quoteUrl}">View your quote</a></p></body></html>`;

    const emailSubject = `Your Turf Quote from ${orgName} - ${formatCurrency(quote.total)}`;

    if (lead.phone) {
      await sendSms(lead.phone, smsBody);
      await logNotification(supabase, {
        lead_id: lead.id,
        quote_id,
        channel: "sms",
        type: "quote_sent",
        recipient: lead.phone,
        body: smsBody,
      });
    }

    if (lead.email) {
      await sendEmail(lead.email, emailSubject, emailHtml, { org });
      await logNotification(supabase, {
        lead_id: lead.id,
        quote_id,
        channel: "email",
        type: "quote_sent",
        recipient: lead.email,
        subject: emailSubject,
        body: emailHtml,
      });
    }

    await supabase
      .from("quotes")
      .update({
        sent_at: new Date().toISOString(),
        status: "sent",
      })
      .eq("id", quote_id);

    await supabase
      .from("leads")
      .update({ status: "quote_sent" })
      .eq("id", lead.id);

    // No team fan-out here. The team member who clicked Send Quote already
    // knows they sent it; pinging the whole org would be noise. Previously
    // this fired type="new_lead" which is just wrong — the lead is already
    // weeks old by the time a quote goes out.

    return jsonResponse({
      message: "Quote sent",
      sms: !!lead.phone,
      email: !!lead.email,
    });
  } catch (err) {
    console.error("send-quote error:", err);
    return errorResponse("Internal server error", 500);
  }
});

async function logNotification(
  supabase: ReturnType<typeof getServiceClient>,
  data: {
    lead_id: string;
    quote_id: string;
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
