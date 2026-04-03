import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1Sig = parts.find((p) => p.startsWith("v1="))?.slice(3);

  if (!timestamp || !v1Sig) return false;

  // Reject events older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedPayload),
  );
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expected === v1Sig;
}

async function stripeGet(endpoint: string) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    // Verify signature if webhook secret is configured
    if (STRIPE_WEBHOOK_SECRET && signature) {
      const valid = await verifyWebhookSignature(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET,
      );
      if (!valid) {
        return errorResponse("Invalid webhook signature", 401);
      }
    }

    const event = JSON.parse(body);
    const supabase = getServiceClient();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const quoteId = session.metadata?.quote_id;

        if (!quoteId) {
          console.error("No quote_id in session metadata");
          break;
        }

        // Get payment intent for the ID
        const paymentIntentId = session.payment_intent;

        await supabase
          .from("quotes")
          .update({
            payment_status: "paid",
            stripe_payment_intent_id: paymentIntentId,
            stripe_checkout_session_id: session.id,
          })
          .eq("id", quoteId);

        // Update lead status
        const { data: quote } = await supabase
          .from("quotes")
          .select("lead_id")
          .eq("id", quoteId)
          .single();

        if (quote?.lead_id) {
          await supabase
            .from("leads")
            .update({ status: "quote_approved" })
            .eq("id", quote.lead_id);
        }

        console.log(`Payment completed for quote ${quoteId}`);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;

        if (!paymentIntentId) break;

        // Look up quote by payment intent
        const { data: quote } = await supabase
          .from("quotes")
          .select("id")
          .eq("stripe_payment_intent_id", paymentIntentId)
          .single();

        if (quote) {
          const refundedFull = charge.amount_refunded >= charge.amount;
          await supabase
            .from("quotes")
            .update({
              payment_status: refundedFull ? "refunded" : "partial",
            })
            .eq("id", quote.id);

          console.log(
            `Refund processed for quote ${quote.id}: ${refundedFull ? "full" : "partial"}`,
          );
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object;
        const quoteId = session.metadata?.quote_id;
        if (quoteId) {
          console.log(`Checkout session expired for quote ${quoteId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return jsonResponse({ received: true });
  } catch (err) {
    console.error("stripe-webhook error:", err);
    return errorResponse("Webhook processing failed", 500);
  }
});
