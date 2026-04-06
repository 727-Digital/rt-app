import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { sendEmail } from "../_shared/resend.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const { name, email } = await req.json();
    if (!name || !email) {
      return errorResponse("name and email are required", 400);
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
        <div style="background: #059669; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Reliable Turf</h1>
        </div>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; padding: 32px 24px;">
          <h2 style="color: #0f172a; margin: 0 0 12px;">Hey ${name}!</h2>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
            Thanks for applying to become a Reliable Turf rep. We've received your application and our team is reviewing it now.
          </p>
          <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
            Here's what happens next:
          </p>
          <ol style="color: #475569; line-height: 1.8; margin: 0 0 16px; padding-left: 20px;">
            <li>We review your application (typically 1–2 business days)</li>
            <li>If approved, you'll receive login credentials via email</li>
            <li>You'll get access to your rep dashboard with leads in your territory</li>
          </ol>
          <p style="color: #475569; line-height: 1.6; margin: 0;">
            If you have any questions in the meantime, just reply to this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="color: #94a3b8; font-size: 13px; margin: 0;">
            Reliable Turf — We supply the leads. You close the deals.
          </p>
        </div>
      </div>
    `;

    await sendEmail(email, "Application Received — Reliable Turf", html);

    return jsonResponse({ sent: true });
  } catch (err) {
    console.error("confirm-rep-application error:", err);
    return errorResponse("Failed to send confirmation email", 500);
  }
});
