// Generate a plain-text approximation of the HTML body. Required for
// deliverability — Gmail/Outlook score HTML-only emails much more
// aggressively for spam. We don't need anything fancy: strip tags, collapse
// whitespace, the URL extracts naturally.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

import type { OrgBranding } from "./branding.ts";

export interface SendEmailOptions {
  replyTo?: string;
  // When provided, the From friendly name and List-Unsubscribe address
  // resolve from this org so each white-label brand sends with its own
  // identity. When absent we fall back to the Reliable Turf defaults.
  org?: OrgBranding | null;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  options: SendEmailOptions = {},
): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  // Friendly From name dramatically improves Gmail/Apple Mail deliverability
  // — raw address-only From headers look robotic and trigger filters. Override
  // via RESEND_FROM_EMAIL if a different address is needed. The friendly
  // name uses the org's name when available so customers see "Pro Green
  // South <help@reliableturf.com>" instead of always "Reliable Turf".
  //
  // help@reliableturf.com is the canonical sender for ALL transactional mail
  // (lead notifications, quotes, reminders, confirmations, etc.) so replies
  // route to a single staffed inbox regardless of which org owns the lead.
  const fromAddress =
    Deno.env.get("RESEND_FROM_EMAIL") || "help@reliableturf.com";
  const friendlyName = options.org?.name || "Reliable Turf";
  const from = fromAddress.includes("<")
    ? fromAddress
    : `${friendlyName} <${fromAddress}>`;

  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured, skipping email");
    return false;
  }

  // RFC 8058 one-click unsubscribe headers. Gmail/Yahoo expect these on
  // transactional/bulk mail; their presence is a strong legitimacy signal
  // and meaningfully reduces the spam score. Address resolves from the
  // org so each brand routes replies to its own inbox.
  const unsubscribeAddress =
    options.org?.email || "help@reliableturf.com";
  const headers: Record<string, string> = {
    "List-Unsubscribe": `<mailto:${unsubscribeAddress}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  const payload: Record<string, unknown> = {
    from,
    to: [to],
    subject,
    html,
    text: htmlToText(html),
    headers,
  };

  // Setting Reply-To to the lead's email lets the recipient hit "Reply" and
  // reach the customer directly. Also signals legitimate transactional mail
  // to inbox providers (bots don't usually want replies).
  if (options.replyTo) {
    payload.reply_to = options.replyTo;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Resend email failed (${res.status}):`, err);
    return false;
  }

  return true;
}
