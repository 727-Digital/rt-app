export async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const token = Deno.env.get("TWILIO_AUTH_TOKEN");
  const from = Deno.env.get("TWILIO_FROM_NUMBER");

  if (!sid || !token || !from) {
    console.warn("Twilio credentials not configured, skipping SMS");
    return false;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const params = new URLSearchParams({ From: from, To: to, Body: body });
  const auth = btoa(`${sid}:${token}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`Twilio SMS failed (${res.status}):`, err);
    return false;
  }

  return true;
}
