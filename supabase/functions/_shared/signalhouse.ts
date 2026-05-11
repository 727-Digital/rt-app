// Signal House SMS helper.
//
// API contract (confirmed live against v2.signalhouse.io via shape probing):
//   POST {SIGNALHOUSE_API_BASE}/message/sms
//   Headers: Authorization: Bearer <JWT>, Content-Type: application/json
//   Body: {
//     senderPhoneNumber: "16784340360",        // digits only, no +, 11-digit E.164
//     recipientPhoneNumber: ["15551234567"],   // singular field name, ARRAY value
//     messageBody: "Hello",
//     statusCallbackUrl?: "https://...",       // optional — Signal House POSTs delivery status here
//     enableShortlink?: false                  // optional
//   }
// Note: The official docs page shows `recipientPhoneNumbers` (plural) at top level,
// but the live API rejects that key. Singular is correct. Verified by probing.
//
// Required env vars (Supabase secrets):
//   SIGNALHOUSE_API_TOKEN     — Bearer JWT from app.signalhouse.io
//   SIGNALHOUSE_FROM_NUMBER   — approved 10DLC number (digits or +E.164, we normalize)
//   SIGNALHOUSE_API_BASE      — defaults to https://v2.signalhouse.io

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  status?: number;
  error?: string;
  raw?: unknown;
}

/**
 * Normalize a phone number to Signal House format: digits only, no +.
 * 10 digits → assume US, prepend "1". 11+ digits → assume already includes country code.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "1" + digits;
  return digits;
}

/**
 * Boolean-only send — drop-in replacement for the Twilio helper.
 * Use sendSmsDetailed() if you need the message ID or error details.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const result = await sendSmsDetailed(to, body);
  return result.success;
}

export async function sendSmsDetailed(
  to: string,
  body: string,
): Promise<SendSmsResult> {
  const token = Deno.env.get("SIGNALHOUSE_API_TOKEN");
  const from = Deno.env.get("SIGNALHOUSE_FROM_NUMBER");
  const base =
    Deno.env.get("SIGNALHOUSE_API_BASE") || "https://v2.signalhouse.io";

  if (!token || !from) {
    console.warn("Signal House credentials not configured, skipping SMS");
    return { success: false, error: "credentials missing" };
  }

  const statusCallbackUrl = Deno.env.get("SIGNALHOUSE_STATUS_CALLBACK_URL");

  const payload: Record<string, unknown> = {
    senderPhoneNumber: normalizePhone(from),
    recipientPhoneNumber: [normalizePhone(to)],
    messageBody: body,
  };
  if (statusCallbackUrl) payload.statusCallbackUrl = statusCallbackUrl;

  let res: Response;
  try {
    res = await fetch(base + "/message/sms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[signalhouse] network error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "network error",
    };
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response — leave data as null
  }

  if (!res.ok) {
    console.error(`[signalhouse] SMS failed (${res.status}):`, JSON.stringify(data));
    const errMsg =
      (data as { error?: string; message?: string })?.error ||
      (data as { error?: string; message?: string })?.message ||
      `HTTP ${res.status}`;
    return {
      success: false,
      status: res.status,
      error: errMsg,
      raw: data,
    };
  }

  // Signal House returns: { insertedMessages: [{ _id, status, carrier, segmentCount, ... }] }
  // Confirmed live 2026-05-10 — HTTP 201 with this exact shape.
  const d = data as { insertedMessages?: Array<Record<string, unknown>> } | null;
  const firstMessage = d?.insertedMessages?.[0];
  const messageId = (firstMessage?._id as string | undefined) || undefined;

  return {
    success: true,
    messageId,
    status: res.status,
    raw: data,
  };
}
