// Apple Push Notification service (APNs) helper.
//
// Sends a push notification to one or more device tokens via Apple's HTTP/2 API.
// Uses token-based auth (JWT signed with ES256 + the .p8 Auth Key) — no
// certificate management, no expiry to worry about.
//
// Required env vars (Supabase secrets):
//   APNS_AUTH_KEY   — contents of AuthKey_XXXX.p8 (PEM-encoded private key)
//   APNS_KEY_ID     — 10-char Key ID from Apple Developer
//   APNS_TEAM_ID    — 10-char Team ID from Apple Developer
//   APNS_BUNDLE_ID  — iOS app bundle ID (e.g. com.reliableturf.app)

// JWT cache — APNs allows the same provider token for ~55 minutes. We regen
// every 50 minutes to be safe.
let cachedJwt: { token: string; expiresAt: number } | null = null;

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function buildJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAt > now + 60) return cachedJwt.token;

  const keyId = Deno.env.get("APNS_KEY_ID");
  const teamId = Deno.env.get("APNS_TEAM_ID");
  const authKey = Deno.env.get("APNS_AUTH_KEY");
  if (!keyId || !teamId || !authKey) {
    throw new Error("APNs credentials missing (APNS_KEY_ID/APNS_TEAM_ID/APNS_AUTH_KEY)");
  }

  const header = { alg: "ES256", kid: keyId, typ: "JWT" };
  const payload = { iss: teamId, iat: now };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(authKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      privateKey,
      new TextEncoder().encode(signingInput),
    ),
  );
  const signatureB64 = base64UrlEncode(signature);
  const token = `${signingInput}.${signatureB64}`;

  // APNs tokens are valid for 60 minutes; rotate at 50.
  cachedJwt = { token, expiresAt: now + 50 * 60 };
  return token;
}

export interface ApnsPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
}

export interface ApnsResult {
  token: string;
  status: number;
  reason?: string;
}

/**
 * Send a push to a single device token. Returns the HTTP status + APNs reason
 * (if any). 200 = delivered. 400/403/410 = bad token (often expired) — caller
 * should mark it inactive.
 */
export async function sendApnsPush(
  deviceToken: string,
  payload: ApnsPayload,
  options: { production?: boolean } = {},
): Promise<ApnsResult> {
  const jwt = await buildJwt();
  const bundleId = Deno.env.get("APNS_BUNDLE_ID");
  if (!bundleId) throw new Error("APNS_BUNDLE_ID not configured");

  // Default to production. TestFlight + App Store builds use prod APNs.
  // Dev builds (Xcode → Run) use sandbox; set production=false for those.
  const host = options.production === false
    ? "api.sandbox.push.apple.com"
    : "api.push.apple.com";

  const apnsPayload = {
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: payload.sound ?? "default",
      ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
    },
    ...(payload.data || {}),
  };

  const res = await fetch(`https://${host}/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      "authorization": `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(apnsPayload),
  });

  let reason: string | undefined;
  if (res.status !== 200) {
    try {
      const body = await res.json();
      reason = body.reason;
    } catch {
      // ignore
    }
  }

  return { token: deviceToken, status: res.status, reason };
}

/** Send the same push to many tokens in parallel. */
export async function sendApnsPushToMany(
  deviceTokens: string[],
  payload: ApnsPayload,
  options: { production?: boolean } = {},
): Promise<ApnsResult[]> {
  return Promise.all(deviceTokens.map((t) => sendApnsPush(t, payload, options)));
}
