export async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<boolean> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from =
    Deno.env.get("RESEND_FROM_EMAIL") || "notifications@reliableturf.com";

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
    body: JSON.stringify({ from, to: [to], subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Resend email failed (${res.status}):`, err);
    return false;
  }

  return true;
}
