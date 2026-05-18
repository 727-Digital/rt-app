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
  quote: Pick<Quote, 'id' | 'line_items' | 'subtotal' | 'total' | 'warranty_text' | 'notes' | 'status' | 'sent_at' | 'valid_until' | 'created_at'> & { payment_status?: PaymentStatus };
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

// Boilerplate process steps. Hardcoded for now; future phase moves these
// to org-level config so each company can customize.
const STEPS_TO_SUCCESS = [
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

const JOBSITE_EXPECTATIONS = [
  'Maintain clean jobsite',
  'Nightly clean up',
  'Work on consecutive days (weather permitting)',
  'Goal is a reference letter',
];

const STANDARD_NOTES = [
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
        <div>
          {branding?.logo_url ? (
            <img src={branding.logo_url} alt={brandName} className="h-10 object-contain" />
          ) : (
            <h2 className="text-2xl font-bold" style={{ color: brandColor }}>
              {brandName}
            </h2>
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
          <FieldRow
            label="Projected Start Date:"
            value={lead?.install_date ? formatDate(lead.install_date) : 'TBD'}
          />
          <FieldRow label="Approx. Length of Job:" value="1-2 Days" />
        </div>
      </div>

      {/* ============================================================
          STEPS TO SUCCESS + JOBSITE EXPECTATIONS
          ============================================================ */}
      <div className="border-t border-slate-100 p-6">
        <h3 className="font-semibold text-slate-900">Steps to Success</h3>
        <BulletList items={STEPS_TO_SUCCESS} />

        <h3 className="mt-6 font-semibold text-slate-900">Jobsite Expectations</h3>
        <BulletList items={JOBSITE_EXPECTATIONS} />
      </div>

      {/* ============================================================
          INSTALLATION DETAILS — project notes + images
          ============================================================ */}
      <div className="border-t border-slate-100 p-6">
        <SectionHeader color={brandColor}>Installation Details</SectionHeader>

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

      {/* ============================================================
          TERMS OF PRICING
          ============================================================ */}
      <div className="border-t border-slate-100 p-6">
        <SectionHeader color={brandColor}>Terms of Pricing</SectionHeader>
        <ul className="mt-3 space-y-1 text-sm text-slate-700">
          <li>40% Down Payment</li>
          <li>60% Balance Upon Completion</li>
          <li className="text-xs text-slate-500">(3% fee on all credit card payments)</li>
        </ul>
      </div>

      {/* ============================================================
          SCOPE OF WORK — line items
          ============================================================ */}
      <div className="border-t border-slate-100 p-6">
        <SectionHeader color={brandColor}>Scope of Work</SectionHeader>
        <table className="mt-4 w-full">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
              <th className="pb-2">Product / Service</th>
              <th className="pb-2 text-center">Qty</th>
              <th className="pb-2 text-right">Unit Price</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {(quote.line_items ?? []).map((item) => (
              <tr key={item.id} className="border-b border-slate-50">
                <td className="py-3 pr-4">
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
                <td className="py-3 text-center text-sm text-slate-600">{item.qty}</td>
                <td className="py-3 text-right text-sm text-slate-600">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="py-3 text-right text-sm font-medium text-slate-900">
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
        <NumberedList items={STANDARD_NOTES} />

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
          <p className="whitespace-pre-line">
            By accepting this Installation Agreement, you (the Owner) authorize{' '}
            {brandName} to perform the work described above at the agreed-upon
            price and timeline. You agree to the payment terms (40% down,
            60% balance upon completion), warranty terms above, and the project
            scope as described.
            {'\n\n'}
            The full terms and conditions, including limitations of liability,
            dispute resolution, and indemnification, are governed by the laws of
            the State in which the work is performed. Please contact your Turf
            Advisor with any questions before signing.
          </p>
        </Collapsible>
      </div>

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
