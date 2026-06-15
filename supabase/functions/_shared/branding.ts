import { createClient } from "jsr:@supabase/supabase-js@2";

export interface OrgBranding {
  id: string;
  name: string;
  primary_color: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  google_review_url: string | null;
}

export async function getOrgBranding(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<OrgBranding> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, primary_color, address, phone, email, logo_url, google_review_url")
    .eq("id", orgId)
    .single();
  if (error) throw error;
  return data as OrgBranding;
}

// Returns a fully-branded transactional email shell. Every chrome
// element — logo, header color, footer identity, unsubscribe link —
// resolves from the org row, so the same template renders identically
// for Reliable Turf, Pro Green South, or any future white-label brand.
//
// Two variants:
//   • Internal recipient (team member): footer mentions notification
//     opt-in language so reps know why they're getting the email.
//   • External recipient (customer): footer is identity only — "you're
//     a team member" copy doesn't apply.
// audience defaults to 'customer' since most outbound mail is to leads.
export function brandedEmailHtml(
  org: OrgBranding,
  title: string,
  bodyHtml: string,
  ctaUrl?: string,
  ctaText?: string,
  audience: "internal" | "customer" = "customer",
): string {
  const color = org.primary_color || "#16a34a";
  const logoBlock = org.logo_url
    ? `<img src="${org.logo_url}" alt="${org.name}" style="max-height:48px;margin-bottom:8px;" />`
    : `<h1 style="color:${color};margin:0;">${org.name}</h1>`;

  const ctaBlock =
    ctaUrl && ctaText
      ? `<div style="text-align:center;margin:32px 0;">
          <a href="${ctaUrl}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-weight:600;font-size:16px;">${ctaText}</a>
        </div>`
      : "";

  // Footer identity line — every value pulled from the org row.
  const identityParts = [org.name];
  if (org.address) identityParts.push(org.address);
  if (org.phone) identityParts.push(org.phone);
  if (org.email) identityParts.push(org.email);
  const identityLine = identityParts.join(" &middot; ");

  const internalLine =
    audience === "internal"
      ? `<p style="margin:0 0 4px;">You're receiving this because you're a team member at ${org.name} and have lead notifications enabled.</p>`
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:20px;background:#f5f5f5;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.1);">
    <div style="text-align:center;margin-bottom:24px;">
      ${logoBlock}
    </div>
    <h2 style="color:${color};margin:0 0 16px;">${title}</h2>
    ${bodyHtml}
    ${ctaBlock}
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px;line-height:1.5;">
      ${internalLine}
      <p style="margin:0 0 4px;">${identityLine}</p>
      <p style="margin:0;"><a href="mailto:${unsubscribeMailto(org)}?subject=Unsubscribe" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`;
}

// Returns the mailto address used both for the footer Unsubscribe link
// and the RFC 8058 List-Unsubscribe header. Prefers the org's own
// email; falls back to help@reliableturf.com — the canonical inbox for
// all transactional support across orgs.
export function unsubscribeMailto(org: OrgBranding | null | undefined): string {
  return org?.email || "help@reliableturf.com";
}
