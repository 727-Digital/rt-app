import { createClient } from "jsr:@supabase/supabase-js@2";

export interface OrgBranding {
  id: string;
  name: string;
  primary_color: string;
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
    .select("id, name, primary_color, phone, email, logo_url, google_review_url")
    .eq("id", orgId)
    .single();
  if (error) throw error;
  return data as OrgBranding;
}

export function brandedEmailHtml(
  org: OrgBranding,
  title: string,
  bodyHtml: string,
  ctaUrl?: string,
  ctaText?: string,
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
    <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px;">${org.name}</p>
  </div>
</body>
</html>`;
}
