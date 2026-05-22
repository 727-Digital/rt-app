import { useState } from 'react';
import { ChevronDown, ChevronUp, Phone, Mail } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { QuoteAttachmentsDisplay } from '@/components/quotes/QuoteAttachmentsEditor';
import { cn, formatCurrency, formatDate, formatQuoteNumber } from '@/lib/utils';
import type { Lead, Organization, PaymentStatus, Quote, QuoteStatus } from '@/lib/types';

interface QuotePreviewBranding {
  name: string;
  logo_url?: string | null;
  primary_color?: string;
  // Optional contact details rendered under the logo in the header.
  // Same data the customer would see on a business card.
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

interface QuotePreviewAttachment {
  id: string;
  file_name: string;
  file_url: string;
  mime_type: string | null;
  file_size: number | null;
}

// Rep assigned to this lead — appears as the "Turf Advisor" on the quote.
// Optional because not every lead has an assigned rep (org fallback).
interface QuotePreviewAdvisor {
  name: string;
  phone?: string | null;
  email?: string | null;
}

interface QuotePreviewProps {
  quote: Pick<
    Quote,
    | 'id'
    | 'line_items'
    | 'subtotal'
    | 'total'
    | 'warranty_text'
    | 'notes'
    | 'status'
    | 'sent_at'
    | 'valid_until'
    | 'created_at'
    | 'turf_area_description'
    | 'edging_coverage'
    | 'areas_of_caution'
    | 'drainage_notes'
    | 'projected_start_date'
    | 'length_estimate'
    | 'client_signature_name'
    | 'client_signature_at'
  > & { payment_status?: PaymentStatus };
  lead: Pick<Lead, 'name' | 'address' | 'phone' | 'email' | 'install_date'> | null;
  quoteNumber?: string;
  branding?: QuotePreviewBranding;
  organization?: Organization | null;
  attachments?: QuotePreviewAttachment[];
  turfAdvisor?: QuotePreviewAdvisor | null;
}

const PAYMENT_STAMP: Record<string, { label: string; className: string }> = {
  paid: { label: 'PAID', className: 'border-emerald-300 bg-emerald-50 text-emerald-700' },
  partial: { label: 'PARTIAL', className: 'border-amber-300 bg-amber-50 text-amber-700' },
  refunded: { label: 'REFUNDED', className: 'border-red-300 bg-red-50 text-red-700' },
};

const STATUS_BADGE: Record<QuoteStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'slate' },
  sent: { label: 'Sent', variant: 'blue' },
  viewed: { label: 'Viewed', variant: 'amber' },
  approved: { label: 'Approved', variant: 'emerald' },
  rejected: { label: 'Rejected', variant: 'red' },
};

// Fallback boilerplate, used only when the org row doesn't have its own
// version yet (legacy orgs / dev seed). The migration sets sensible
// defaults on the column so most orgs read these from the DB.
const DEFAULT_STEPS_TO_SUCCESS = [
  'Excavation as needed to allow for base',
  'Cap sprinkler heads upon request',
  'Install base & grade as needed',
  'Compact base as needed',
  'Lay weed control fabric as needed',
  'Add edging as needed',
  'Install & seam artificial turf',
  'Spread infill',
  'Power broom turf system',
];

const DEFAULT_JOBSITE_EXPECTATIONS = [
  'Maintain clean jobsite',
  'Nightly clean up',
  'Work on consecutive days (weather permitting)',
  'Goal is a reference letter',
];

const DEFAULT_STANDARD_NOTES = [
  'Pricing listed reflects total investment (Artificial Turf System, Labor & Materials).',
  '15 Year Turf Manufacturer’s Product Limited Warranty & 3 Year Company Labor Limited Warranty.',
  'Company carries $1,000,000 liability insurance.',
  'Owner agrees to move all movable items from the turf area prior to installation.',
  'All discounts & coupons have been applied to this proposal. No further discounts available.',
  'Standard excavation to allow for base material installation; base amount varies by site needs. Additional excavation or build-up will incur extra costs, documented in a signed electronic change order.',
  'Low-E Coated Window Advisory: Reflections from windows coated with Low-E film can damage or burn artificial turf. Turf burn is not covered under either the Company’s or the manufacturer’s limited warranty.',
  'Company strongly recommends all irrigation system parts, such as heads and piping, be removed from under the turf installation area.',
];

// ---------------------------------------------------------------------------
// Helper sub-components for the structured layout. Kept inline so the
// whole quote-display module stays in one file and easy to reason about.
// ---------------------------------------------------------------------------

function SectionHeader({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <h2
      className="border-b border-slate-200 pb-2 text-lg font-bold"
      style={{ color }}
    >
      {children}
    </h2>
  );
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <span className="text-right text-sm text-slate-900">{value}</span>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="ml-4 mt-2 list-disc space-y-1.5 text-sm text-slate-700">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="ml-5 mt-2 list-decimal space-y-1.5 text-sm text-slate-700">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ol>
  );
}

function Collapsible({
  title,
  children,
  color,
}: {
  title: string;
  children: React.ReactNode;
  color: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold" style={{ color }}>
          {title}
        </span>
        {open ? (
          <ChevronUp size={16} className="text-slate-400" />
        ) : (
          <ChevronDown size={16} className="text-slate-400" />
        )}
      </button>
      {open && (
        <div className="border-t border-slate-200 px-4 py-3 text-xs leading-relaxed text-slate-600">
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function QuotePreview({
  quote,
  lead,
  quoteNumber,
  branding,
  organization,
  attachments,
  turfAdvisor,
}: QuotePreviewProps) {
  const badge = quote.status ? STATUS_BADGE[quote.status] : null;
  const brandName = branding?.name || organization?.name || 'TurfFlow';
  const brandColor = branding?.primary_color || organization?.primary_color || '#059669';
  const paymentStamp = quote.payment_status ? PAYMENT_STAMP[quote.payment_status] : null;
  const displayQuoteNumber = quoteNumber ?? formatQuoteNumber(quote.id, lead?.name);
  const sentDate = quote.sent_at ? formatDate(quote.sent_at) : formatDate(quote.created_at);

  // Per-quote → org-default → hardcoded fallback. Each layer of the chain
  // exists so older quotes / orgs render correctly even without the new
  // template fields populated.
  const stepsToSuccess = organization?.process_steps ?? DEFAULT_STEPS_TO_SUCCESS;
  const jobsiteExpectations = organization?.jobsite_expectations ?? DEFAULT_JOBSITE_EXPECTATIONS;
  const standardNotes = organization?.boilerplate_notes ?? DEFAULT_STANDARD_NOTES;
  const downPct = organization?.payment_terms_down_pct ?? 40;
  const balancePct = organization?.payment_terms_balance_pct ?? 60;
  const ccFeePct = organization?.credit_card_fee_pct ?? 3.0;
  const lengthEstimate =
    quote.length_estimate || organization?.default_length_estimate || '1-2 Days';
  const projectedStart =
    quote.projected_start_date ||
    (lead?.install_date ? formatDate(lead.install_date) : 'TBD');
  const tcsBody =
    organization?.terms_and_conditions_long ||
    `By accepting this Installation Agreement, you (the Owner) authorize ${brandName} to perform the work described above at the agreed-upon price and timeline. You agree to the payment terms (${downPct}% down, ${balancePct}% balance upon completion), warranty terms above, and the project scope as described.

The full terms and conditions, including limitations of liability, dispute resolution, and indemnification, are governed by the laws of the State in which the work is performed. Please contact your Turf Advisor with any questions before signing.`;

  const hasInstallationDetails =
    !!(quote.turf_area_description ||
      quote.edging_coverage ||
      quote.areas_of_caution ||
      quote.drainage_notes ||
      quote.notes ||
      (attachments && attachments.length > 0));

  return (
    <div className="relative rounded-xl border border-slate-200 bg-white">
      {paymentStamp && (
        <div className="absolute right-4 top-4 z-10">
          <span
            className={cn(
              'inline-block rotate-12 rounded border-2 px-3 py-1 text-sm font-bold uppercase tracking-wider',
              paymentStamp.className,
            )}
          >
            {paymentStamp.label}
          </span>
        </div>
      )}

      {/* ============================================================
          HEADER — logo / brand name + status badge
          ============================================================ */}
      <div className="flex items-start justify-between border-b border-slate-100 p-6">
        <div className="flex flex-col items-start gap-1.5">
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt={brandName} className="h-12 object-contain" />
          ) : (
            <h2 className="text-2xl font-bold" style={{ color: brandColor }}>
              {brandName}
            </h2>
          )}
          {(branding?.address || branding?.phone || branding?.email) && (
            <div className="text-xs leading-snug text-slate-500">
              {branding.address && (
                <p className="whitespace-pre-line">{branding.address}</p>
              )}
              {(branding.phone || branding.email) && (
                <p className="mt-0.5">
                  {branding.phone && <span>{branding.phone}</span>}
                  {branding.phone && branding.email && <span> · </span>}
                  {branding.email && <span>{branding.email}</span>}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
        </div>
      </div>

      {/* ============================================================
          INSTALLATION AGREEMENT title + proposal-for block
          ============================================================ */}
      <div className="p-6">
        <h1 className="text-3xl font-bold text-slate-900">Installation Agreement</h1>
        <div className="mt-6">
          <p className="text-xl font-semibold" style={{ color: brandColor }}>
            Proposal for: {lead?.name ?? '—'}
          </p>
          {lead?.address && (
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
              {lead.address}
            </p>
          )}
        </div>
      </div>

      {/* ============================================================
          PROJECT OVERVIEW — quote #, date, advisor
          ============================================================ */}
      <div className="border-t border-slate-100 p-6">
        <SectionHeader color={brandColor}>Project Overview</SectionHeader>
        <div className="mt-3 flex flex-col">
          <FieldRow label="Quote #:" value={displayQuoteNumber} />
          <FieldRow label="Date:" value={sentDate} />
          {turfAdvisor && (
            <>
              <FieldRow label="Turf Advisor:" value={turfAdvisor.name} />
              {turfAdvisor.phone && (
                <FieldRow label="Turf Advisor Phone:" value={turfAdvisor.phone} />
              )}
              {turfAdvisor.email && (
                <FieldRow
                  label="Turf Advisor Email:"
                  value={
                    <a
                      href={`mailto:${turfAdvisor.email}`}
                      className="hover:underline"
                      style={{ color: brandColor }}
                    >
                      {turfAdvisor.email}
                    </a>
                  }
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ============================================================
          PROJECT PRICING — big top-line number
          ============================================================ */}
      <div className="border-t border-slate-100 p-6">
        <SectionHeader color={brandColor}>Project Pricing</SectionHeader>
        <p className="mt-4 text-2xl font-bold text-slate-900">
          Standard Price: {formatCurrency(quote.total ?? 0)}
        </p>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          *Pricing provided is subject to all applicable taxes and may vary
          depending on the specific line item selections and customization
          options chosen.
          {quote.valid_until && (
            <> Standard price is good until {formatDate(quote.valid_until)}.</>
          )}
          {!quote.valid_until && <> Standard price is good for 30 days from the date of this quote above.</>}
        </p>
      </div>

      {/* ============================================================
          PROJECT TIMELINE
          ============================================================ */}
      <div className="border-t border-slate-100 p-6">
        <SectionHeader color={brandColor}>Project Timeline</SectionHeader>
        <div className="mt-3 flex flex-col">
          <FieldRow label="Projected Start Date:" value={projectedStart} />
          <FieldRow label="Approx. Length of Job:" value={lengthEstimate} />
        </div>
      </div>

      {/* ============================================================
          STEPS TO SUCCESS + JOBSITE EXPECTATIONS
          ============================================================ */}
      <div className="border-t border-slate-100 p-6">
        <h3 className="font-semibold text-slate-900">Steps to Success</h3>
        <BulletList items={stepsToSuccess} />

        <h3 className="mt-6 font-semibold text-slate-900">Jobsite Expectations</h3>
        <BulletList items={jobsiteExpectations} />
      </div>

      {/* ============================================================
          INSTALLATION DETAILS — structured fields + images
          Hidden entirely if every field is empty (avoids an awkward
          stub section on early drafts).
          ============================================================ */}
      {hasInstallationDetails && (
        <div className="border-t border-slate-100 p-6">
          <SectionHeader color={brandColor}>Installation Details</SectionHeader>

          {quote.turf_area_description && (
            <div className="mt-4">
              <p className="font-semibold text-slate-900">Turf Area Description</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {quote.turf_area_description}
              </p>
            </div>
          )}

          {quote.edging_coverage && (
            <div className="mt-4">
              <p className="font-semibold text-slate-900">Edging Coverage</p>
              <p className="mt-1 text-sm text-slate-700">{quote.edging_coverage}</p>
            </div>
          )}

          {quote.areas_of_caution && (
            <div className="mt-4">
              <p className="font-semibold text-slate-900">Areas of Caution</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {quote.areas_of_caution}
              </p>
            </div>
          )}

          {quote.drainage_notes && (
            <div className="mt-4">
              <p className="font-semibold text-slate-900">Drainage &amp; Downspouts</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {quote.drainage_notes}
              </p>
            </div>
          )}

          {quote.notes && (
            <div className="mt-4">
              <p className="font-semibold text-slate-900">Additional Project Notes</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
                {quote.notes}
              </p>
            </div>
          )}

          {attachments && attachments.length > 0 && (
            <div className="mt-4">
              <p className="font-semibold text-slate-900">Project Images</p>
              <div className="mt-3">
                <QuoteAttachmentsDisplay attachments={attachments} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================
          TERMS OF PRICING — driven by org-level config
          ============================================================ */}
      <div className="border-t border-slate-100 p-6">
        <SectionHeader color={brandColor}>Terms of Pricing</SectionHeader>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          <li>{downPct}% Down Payment</li>
          <li>{balancePct}% Balance Upon Completion</li>
          <li className="text-xs text-slate-500">
            ({ccFeePct}% fee on all credit card payments)
          </li>
        </ul>
      </div>

      {/* ============================================================
          SCOPE OF WORK — line items
          ============================================================ */}
      <div className="border-t border-slate-100 p-6">
        <SectionHeader color={brandColor}>Scope of Work</SectionHeader>
        <table className="mt-4 w-full table-fixed">
          {/* Explicit column widths so the numeric columns never get
              squeezed by long product descriptions and the headers stop
              wrapping/overlapping on narrow viewports. */}
          <colgroup>
            <col />
            <col className="w-12" />
            <col className="w-24" />
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-3">Product / Service</th>
              <th className="pb-2 px-2 text-center whitespace-nowrap">Qty</th>
              <th className="pb-2 px-2 text-right whitespace-nowrap">Price</th>
              <th className="pb-2 pl-2 text-right whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody>
            {(quote.line_items ?? []).map((item) => (
              <tr key={item.id} className="border-b border-slate-50">
                <td className="py-3 pr-3 align-top">
                  <p className="text-sm font-medium text-slate-900">
                    {item.description}
                  </p>
                  {item.details.length > 0 && (
                    <ul className="mt-1.5 flex flex-col gap-0.5">
                      {item.details
                        .filter((d) => d.trim())
                        .map((detail, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 text-xs text-slate-500"
                          >
                            <span className="mt-1 block h-1 w-1 flex-shrink-0 rounded-full bg-slate-300" />
                            {detail}
                          </li>
                        ))}
                    </ul>
                  )}
                </td>
                <td className="py-3 px-2 text-center align-top text-sm text-slate-600 whitespace-nowrap">{item.qty}</td>
                <td className="py-3 px-2 text-right align-top text-sm text-slate-600 whitespace-nowrap">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="py-3 pl-2 text-right align-top text-sm font-medium text-slate-900 whitespace-nowrap">
                  {formatCurrency(item.qty * item.unit_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-col items-end gap-1 border-t border-slate-200 pt-4">
          <div className="flex items-center gap-8">
            <span className="text-sm text-slate-500">Subtotal</span>
            <span className="text-sm font-medium text-slate-700">
              {formatCurrency(quote.subtotal ?? 0)}
            </span>
          </div>
          <div className="flex items-center gap-8">
            <span className="text-sm font-semibold text-slate-900">Total</span>
            <span className="text-lg font-bold text-slate-900">
              {formatCurrency(quote.total ?? 0)}
            </span>
          </div>
        </div>
      </div>

      {/* ============================================================
          NOTES — boilerplate warranty / insurance / liability
          ============================================================ */}
      <div className="border-t border-slate-100 p-6">
        <h3 className="font-semibold text-slate-900">Notes</h3>
        <NumberedList items={standardNotes} />

        {quote.warranty_text && quote.warranty_text.trim() && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Additional Warranty Notes
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">
              {quote.warranty_text}
            </p>
          </div>
        )}
      </div>

      {/* ============================================================
          TERMS & CONDITIONS — collapsible
          ============================================================ */}
      <div className="border-t border-slate-100 p-6">
        <Collapsible
          title={`${brandName} Terms and Conditions - Click to view`}
          color={brandColor}
        >
          <p className="whitespace-pre-line">{tcsBody}</p>
        </Collapsible>
      </div>

      {/* ============================================================
          SIGNATURE — only renders after the customer types their name
          on the public quote page. Displays as a signed block once set.
          ============================================================ */}
      {quote.client_signature_name && (
        <div className="border-t border-slate-100 p-6">
          <SectionHeader color={brandColor}>Signed</SectionHeader>
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Client Signature
            </p>
            <p
              className="mt-1 text-2xl"
              style={{
                fontFamily: '"Brush Script MT", "Snell Roundhand", cursive',
                color: brandColor,
              }}
            >
              {quote.client_signature_name}
            </p>
            {quote.client_signature_at && (
              <p className="mt-2 text-xs text-slate-500">
                Signed on {formatDate(quote.client_signature_at)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ============================================================
          FOOTER — contact / sent date
          ============================================================ */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-6 py-3 text-xs text-slate-400">
        <div className="flex flex-wrap gap-4">
          {organization?.phone && (
            <span className="inline-flex items-center gap-1">
              <Phone size={10} />
              {organization.phone}
            </span>
          )}
          {organization?.email && (
            <span className="inline-flex items-center gap-1">
              <Mail size={10} />
              {organization.email}
            </span>
          )}
        </div>
        {quote.sent_at && <span>Sent {formatDate(quote.sent_at)}</span>}
      </div>
    </div>
  );
}

export { QuotePreview };
