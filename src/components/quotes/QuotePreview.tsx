import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Lead, Quote, QuoteStatus } from '@/lib/types';

interface QuotePreviewBranding {
  name: string;
  logo_url?: string | null;
  primary_color?: string;
}

interface QuotePreviewProps {
  quote: Pick<Quote, 'line_items' | 'subtotal' | 'total' | 'warranty_text' | 'notes' | 'status' | 'sent_at' | 'valid_until'>;
  lead: Pick<Lead, 'name' | 'address' | 'phone' | 'email'>;
  quoteNumber?: string;
  branding?: QuotePreviewBranding;
}

const STATUS_BADGE: Record<QuoteStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'slate' },
  sent: { label: 'Sent', variant: 'blue' },
  viewed: { label: 'Viewed', variant: 'amber' },
  approved: { label: 'Approved', variant: 'emerald' },
  rejected: { label: 'Rejected', variant: 'red' },
};

function QuotePreview({ quote, lead, quoteNumber, branding }: QuotePreviewProps) {
  const badge = quote.status ? STATUS_BADGE[quote.status] : null;
  const brandName = branding?.name || 'Reliable Turf';
  const brandColor = branding?.primary_color || '#059669';

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start justify-between border-b border-slate-100 p-6">
        <div>
          {branding?.logo_url ? (
            <img
              src={branding.logo_url}
              alt={brandName}
              className="h-8 object-contain"
            />
          ) : (
            <h2 className="text-xl font-bold" style={{ color: brandColor }}>
              {brandName}
            </h2>
          )}
          <p className="mt-0.5 text-xs text-slate-400">
            {quoteNumber ? `Quote #${quoteNumber}` : 'Quote Preview'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
          {quote.sent_at && (
            <p className="text-xs text-slate-400">
              Sent {formatDate(quote.sent_at)}
            </p>
          )}
        </div>
      </div>

      <div className="border-b border-slate-100 p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Prepared For
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">
          {lead.name}
        </p>
        {lead.address && (
          <p className="text-sm text-slate-600">{lead.address}</p>
        )}
        {lead.phone && (
          <p className="text-sm text-slate-600">{lead.phone}</p>
        )}
        {lead.email && (
          <p className="text-sm text-slate-600">{lead.email}</p>
        )}
      </div>

      <div className="p-6">
        <table className="w-full">
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
                <td className="py-3 text-center text-sm text-slate-600">
                  {item.qty}
                </td>
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

      {quote.warranty_text && (
        <div className="border-t border-slate-100 p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Warranty
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
            {quote.warranty_text}
          </p>
        </div>
      )}

      {quote.notes && (
        <div className="border-t border-slate-100 p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Notes
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
            {quote.notes}
          </p>
        </div>
      )}

      {quote.valid_until && (
        <div className="border-t border-slate-100 px-6 py-3">
          <p className="text-xs text-slate-400">
            Valid until {formatDate(quote.valid_until)}
          </p>
        </div>
      )}
    </div>
  );
}

export { QuotePreview };
