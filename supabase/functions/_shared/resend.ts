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

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  // Friendly From name dramatically improves Gmail/Apple Mail deliverability
  // — raw address-only From headers look robotic and trigger filters. Override
  // via RESEND_FROM_EMAIL if a different address is needed.
  const fromAddress =
    Deno.env.get("RESEND_FROM_EMAIL") || "notifications@reliableturf.com";
  const from = fromAddress.includes("<")
    ? fromAddress
    : `Reliable Turf <${fromAddress}>`;

  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured, skipping email");
    return false;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text: htmlToText(html),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Resend email failed (${res.status}):`, err);
    return false;
  }

  return true;
}
