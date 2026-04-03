import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsResponse, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");

async function stripeRequest(endpoint: string, body: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || "Stripe API error");
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return corsResponse();

  try {
    if (!STRIPE_SECRET_KEY) {
      return errorResponse("Stripe is not configured", 500);
    }

    const { quote_id, payment_type } = await req.json();
    if (!quote_id) return errorResponse("quote_id is required");

    const supabase = getServiceClient();
    const appUrl = Deno.env.get("APP_URL") || "https://app.reliableturf.com";

    const { data: quote, error: quoteErr } = await supabase
      .from("quotes")
      .select("*, lead:leads(*), organization:organizations(*)")
      .eq("id", quote_id)
      .single();

    if (quoteErr || !quote) {
      return errorResponse("Quote not found", 404);
    }

    if (quote.payment_status === "paid") {
      return errorResponse("Quote is already paid");
    }

    const lead = quote.lead;
    if (!lead) {
      return errorResponse("Lead not found for quote", 404);
    }

    const org = quote.organization;
    const orgName = org?.name || "Reliable Turf";
    const amountCents = Math.round(quote.total * 100);

    const paymentMethodTypes =
      payment_type === "ach" ? "us_bank_account" : "card";

    const params: Record<string, string> = {
      "mode": "payment",
      "success_url": `${appUrl}/q/${quote_id}?payment=success`,
      "cancel_url": `${appUrl}/q/${quote_id}?payment=cancelled`,
      "line_items[0][price_data][currency]": "usd",
      "line_items[0][price_data][unit_amount]": amountCents.toString(),
      "line_items[0][price_data][product_data][name]": `Turf Installation - ${orgName}`,
      "line_items[0][price_data][product_data][description]": `Quote #${quote_id.slice(0, 8)}`,
      "line_items[0][quantity]": "1",
      "payment_method_types[0]": paymentMethodTypes,
      "metadata[quote_id]": quote_id,
      "metadata[org_id]": quote.org_id,
      "metadata[lead_id]": lead.id,
    };

    if (lead.email) {
      params["customer_email"] = lead.email;
    }

    // If org has a connected Stripe account, use it for direct charges
    if (org?.stripe_account_id) {
      params["payment_intent_data[transfer_data][destination]"] =
        org.stripe_account_id;
    }

    const session = await stripeRequest("/checkout/sessions", params);

    // Save session ID to quote
    await supabase
      .from("quotes")
      .update({
        stripe_checkout_session_id: session.id,
        payment_method: payment_type === "ach" ? "ach" : "card",
      })
      .eq("id", quote_id);

    return jsonResponse({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error("create-checkout-session error:", err);
    return errorResponse(
      err instanceof Error ? err.message : "Internal server error",
      500,
    );
  }
});
