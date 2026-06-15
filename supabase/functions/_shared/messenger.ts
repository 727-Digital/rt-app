// FB Messenger Send API wrapper.
//
// Outbound DMs go through POST /v21.0/me/messages with a Page Access
// Token. The token is shared with the leadgen path because Meta scopes
// tokens per Page, not per webhook field — same RT Page token works for
// both reading leadgen results and sending DMs.
//
// 24-hour rule: Meta only allows free-form DMs within 24 hours of the
// user's last message to the Page. Outside that window we'd need a
// messaging_tag (e.g. HUMAN_AGENT). We don't enforce that here; the
// rep-reply UI is for active conversations so the window almost always
// applies. If the rep tries to reply to a stale thread Meta returns an
// error and we surface it.

interface MessengerSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: unknown;
}

interface FetchProfileResult {
  first_name?: string;
  last_name?: string;
  name?: string;
}

const GRAPH_VERSION = "v21.0";

function pageToken(): string | null {
  return Deno.env.get("FB_PAGE_ACCESS_TOKEN") ?? null;
}

export async function sendMessengerMessage(
  psid: string,
  body: string,
  token?: string,
): Promise<MessengerSendResult> {
  const accessToken = token ?? pageToken();
  if (!accessToken) {
    return { success: false, error: "FB_PAGE_ACCESS_TOKEN not configured" };
  }

  try {
    const url =
      `https://graph.facebook.com/${GRAPH_VERSION}/me/messages?access_token=${accessToken}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text: body },
        // RESPONSE tag is appropriate when replying within the 24h
        // window. Outside it Meta will reject — let the error bubble up
        // rather than silently degrade to a stale tag.
        messaging_type: "RESPONSE",
      }),
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      return {
        success: false,
        error: json.error?.message ?? `HTTP ${res.status}`,
        raw: json,
      };
    }
    return {
      success: true,
      messageId: json.message_id as string | undefined,
      raw: json,
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// Pulls the user's profile name so we can label the lead with something
// human ("Jamie Rivera") instead of just the raw PSID. Falls back to
// "Messenger Lead" if Meta declines — name is non-essential.
export async function fetchMessengerProfile(
  psid: string,
  token?: string,
): Promise<FetchProfileResult | null> {
  const accessToken = token ?? pageToken();
  if (!accessToken) return null;
  try {
    const url =
      `https://graph.facebook.com/${GRAPH_VERSION}/${psid}?fields=first_name,last_name,name&access_token=${accessToken}`;
    const res = await fetch(url);
    const json = await res.json();
    if (!res.ok || json.error) return null;
    return json as FetchProfileResult;
  } catch {
    return null;
  }
}
