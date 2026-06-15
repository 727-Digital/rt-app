import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getServiceClient } from "../_shared/supabase.ts";

// Signal House webhook receiver.
// Subscribed events: SMS_SENT, SMS_FAILED, MESSAGE_DELIVERED, MESSAGE_FAILED, MESSAGE_RECEIVED.
//
// We defensively parse the payload because the exact event envelope shape isn't yet documented.
// The message object itself follows the GET /message response shape — confirmed live:
//   { _id, direction, senderPhoneNumber, recipientPhoneNumber, messageBody, status, messageType, ... }
//
// Behavior:
// - MESSAGE_RECEIVED (inbound): match phone → lead, insert messages row.
// - SMS_SENT / MESSAGE_DELIVERED / MESSAGE_FAILED / SMS_FAILED (outbound status):
//     update existing messages row by provider message id (stored in twilio_sid column for now).
// - Everything else: log and 200.

interface MessageLike {
  _id?: string;
  direction?: string;
  senderPhoneNumber?: string;
  recipientPhoneNumber?: string;
  messageBody?: string;
  status?: string;
  messageType?: string;
  carrier?: string;
}

function extractMessage(body: unknown): {
  eventType: string | null;
  message: MessageLike | null;
  raw: unknown;
} {
  if (!body || typeof body !== "object") {
    return { eventType: null, message: null, raw: body };
  }
  const b = body as Record<string, unknown>;

  const eventType =
    (b.event as string) ||
    (b.eventType as string) ||
    (b.type as string) ||
    (b.eventName as string) ||
    null;

  // Try common envelope locations for the message object.
  // Signal House confirmed shape (2026-05-10): { event, timestamp, identifier, metaData: { Message: {...} } }
  const metaData = b.metaData as Record<string, unknown> | undefined;
  let message: MessageLike | null = null;
  const candidates: unknown[] = [
    metaData?.Message,
    metaData?.message,
    metaData,
    b.data,
    b.message,
    b.payload,
    b,
  ];
  for (const c of candidates) {
    if (c && typeof c === "object") {
      const m = c as MessageLike;
      if (m._id || m.messageBody || m.senderPhoneNumber) {
        message = m;
        break;
      }
    }
  }

  return { eventType, message, raw: body };
}

function normalizeToDigits(phone: string | undefined | null): string {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

async function handleInbound(message: MessageLike) {
  const supabase = getServiceClient();
  const fromDigits = normalizeToDigits(message.senderPhoneNumber);
  const toDigits = normalizeToDigits(message.recipientPhoneNumber);

  if (!fromDigits || !message.messageBody) {
    console.warn("[signalhouse-webhook] inbound missing from/body, skipping insert");
    return;
  }

  // Match lead by phone — must handle multiple stored formats:
  //   "(850) 582-4588", "850-582-4588", "850.582.4588", "8505824588", "+18505824588"
  // Strategy: search for each digit-group with wildcards between them — order matters,
  // so "%850%582%4588" matches all of the above formats.
  const fromPlus = "+" + fromDigits;
  const localDigits = fromDigits.startsWith("1") ? fromDigits.slice(1) : fromDigits;
  // Build a fuzzy pattern from the last 10 digits: area + exchange + line
  const area = localDigits.slice(0, 3);
  const exchange = localDigits.slice(3, 6);
  const line = localDigits.slice(6, 10);
  const fuzzy = `%${area}%${exchange}%${line}%`;

  const { data: lead } = await supabase
    .from("leads")
    .select("id, org_id, phone")
    .or(
      `phone.eq.${fromPlus},phone.eq.${fromDigits},phone.ilike.%${localDigits},phone.ilike.${fuzzy}`,
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lead) {
    console.warn(
      `[signalhouse-webhook] no lead found for inbound from ${fromDigits}`,
    );
    return;
  }

  // Avoid duplicate inserts when Signal House retries — check by provider message id.
  if (message._id) {
    const { data: existing } = await supabase
      .from("messages")
      .select("id")
      .eq("twilio_sid", message._id)
      .maybeSingle();
    if (existing) {
      console.log(`[signalhouse-webhook] inbound ${message._id} already recorded, skipping`);
      return;
    }
  }

  const { error: insertError } = await supabase.from("messages").insert({
    lead_id: lead.id,
    org_id: lead.org_id,
    direction: "inbound",
    channel: "sms",
    from_number: fromPlus,
    to_number: toDigits ? "+" + toDigits : null,
    body: message.messageBody,
    twilio_sid: message._id ?? null, // legacy column — reused for provider message id
    status: "received",
  });

  if (insertError) {
    console.error("[signalhouse-webhook] failed to insert inbound message:", insertError);
  } else {
    console.log(`[signalhouse-webhook] inbound recorded for lead ${lead.id}`);
  }
}

async function handleStatusUpdate(message: MessageLike, eventType: string) {
  if (!message._id) {
    console.warn(`[signalhouse-webhook] ${eventType} missing _id, skipping`);
    return;
  }

  // Map Signal House event → messages.status value.
  const statusMap: Record<string, string> = {
    SMS_SENT: "sent",
    MESSAGE_DELIVERED: "delivered",
    SMS_FAILED: "failed",
    MESSAGE_FAILED: "failed",
  };
  const newStatus = statusMap[eventType] || message.status?.toLowerCase() || "unknown";

  const supabase = getServiceClient();
  const { error } = await supabase
    .from("messages")
    .update({ status: newStatus })
    .eq("twilio_sid", message._id);

  if (error) {
    console.error(`[signalhouse-webhook] failed to update ${message._id} → ${newStatus}:`, error);
  } else {
    console.log(`[signalhouse-webhook] ${message._id} → ${newStatus}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200 });
  }
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ ok: true, service: "signalhouse-webhook" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // Shared-secret gate (audit H2). Signal House calls a fixed URL we
  // configure in their dashboard; append `?token=<secret>` to it. This
  // is ENFORCED ONLY once SIGNALHOUSE_WEBHOOK_SECRET is set — so turning
  // it on is a coordinated step (set the secret AND update the Signal
  // House webhook URL to include the token). Until then it no-ops so
  // inbound SMS / delivery statuses keep flowing. Without it, anyone can
  // inject fake inbound customer messages and forge delivery statuses.
  const expectedToken = Deno.env.get("SIGNALHOUSE_WEBHOOK_SECRET");
  if (expectedToken) {
    const provided =
      new URL(req.url).searchParams.get("token") ||
      req.headers.get("x-webhook-token") ||
      "";
    if (provided !== expectedToken) {
      console.warn("[signalhouse-webhook] rejected: bad/missing webhook token");
      return new Response("Forbidden", { status: 403 });
    }
  }

  let rawBody = "";
  let parsed: unknown = null;
  const contentType = req.headers.get("content-type") || "";

  try {
    rawBody = await req.text();
    if (contentType.includes("application/json")) {
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        parsed = rawBody;
      }
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      parsed = Object.fromEntries(new URLSearchParams(rawBody));
    } else {
      parsed = rawBody;
    }
  } catch (e) {
    console.error("[signalhouse-webhook] body read failed:", e);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  const { eventType, message } = extractMessage(parsed);

  console.log(
    "[signalhouse-webhook]",
    JSON.stringify({
      eventType,
      hasMessage: !!message,
      direction: message?.direction,
      _id: message?._id,
      rawBodyPreview: rawBody.slice(0, 600),
    }),
  );

  try {
    if (message) {
      // Inbound: customer reply.
      if (
        eventType === "MESSAGE_RECEIVED" ||
        message.direction === "INBOUND"
      ) {
        await handleInbound(message);
      } else if (eventType) {
        await handleStatusUpdate(message, eventType);
      }
    } else {
      console.warn(
        "[signalhouse-webhook] couldn't extract message from payload",
        JSON.stringify({ eventType, rawBodyPreview: rawBody.slice(0, 500) }),
      );
    }
  } catch (e) {
    console.error("[signalhouse-webhook] handler error:", e);
    // still return 200 so Signal House doesn't retry-storm
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
