export async function hashUserData(value: string): Promise<string> {
  const normalized = value.toLowerCase().trim();
  const encoded = new TextEncoder().encode(normalized);
  const buffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return "1" + digits;
  return digits;
}

interface ConversionEventParams {
  event_name: string;
  event_time: number;
  event_id: string;
  user_data: {
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    zip?: string;
  };
  custom_data?: Record<string, unknown>;
}

export async function sendConversionEvent(
  params: ConversionEventParams,
): Promise<boolean> {
  const pixelId = Deno.env.get("FB_PIXEL_ID");
  const accessToken =
    Deno.env.get("FB_CAPI_ACCESS_TOKEN") ||
    Deno.env.get("FB_PAGE_ACCESS_TOKEN");

  if (!pixelId || !accessToken) {
    console.warn("Facebook CAPI credentials not configured, skipping");
    return false;
  }

  const userData: Record<string, string[]> = {};
  if (params.user_data.email) {
    userData.em = [await hashUserData(params.user_data.email)];
  }
  if (params.user_data.phone) {
    const normalized = normalizePhone(params.user_data.phone);
    userData.ph = [await hashUserData(normalized)];
  }
  if (params.user_data.first_name) {
    userData.fn = [await hashUserData(params.user_data.first_name)];
  }
  if (params.user_data.last_name) {
    userData.ln = [await hashUserData(params.user_data.last_name)];
  }
  if (params.user_data.zip) {
    userData.zp = [await hashUserData(params.user_data.zip)];
  }

  const payload = {
    data: [
      {
        event_name: params.event_name,
        event_time: params.event_time,
        event_id: params.event_id,
        action_source: "system",
        user_data: userData,
        custom_data: params.custom_data || undefined,
      },
    ],
  };

  const url = `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Facebook CAPI failed (${res.status}):`, err);
    return false;
  }

  const result = await res.json();
  console.log("Facebook CAPI response:", JSON.stringify(result));
  return true;
}

interface AudienceUser {
  email?: string;
  phone?: string;
}

export async function addToCustomAudience(
  audienceId: string,
  users: AudienceUser[],
): Promise<boolean> {
  const accessToken =
    Deno.env.get("FB_CAPI_ACCESS_TOKEN") ||
    Deno.env.get("FB_PAGE_ACCESS_TOKEN");

  if (!accessToken) {
    console.warn("Facebook access token not configured, skipping audience sync");
    return false;
  }

  const data: string[][] = [];
  for (const user of users) {
    const row: string[] = [];
    row.push(user.email ? await hashUserData(user.email) : "");
    row.push(
      user.phone ? await hashUserData(normalizePhone(user.phone)) : "",
    );
    data.push(row);
  }

  const payload = {
    payload: {
      schema: ["EMAIL", "PHONE"],
      data,
    },
  };

  const url = `https://graph.facebook.com/v21.0/${audienceId}/users?access_token=${accessToken}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Facebook Audience sync failed (${res.status}):`, err);
    return false;
  }

  const result = await res.json();
  console.log("Facebook Audience sync response:", JSON.stringify(result));
  return true;
}
