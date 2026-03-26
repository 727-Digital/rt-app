import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye, PenLine, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
import { LineItemEditor, createDefaultItem } from '@/components/quotes/LineItemEditor';
import { QuotePreview } from '@/components/quotes/QuotePreview';
import { QuoteViewTracker } from '@/components/quotes/QuoteViewTracker';
import { fetchQuote, createQuote, updateQuote } from '@/lib/queries/quotes';
import { fetchLead, createLead, updateLeadStatus } from '@/lib/queries/leads';
import { supabase } from '@/lib/supabase';
import type { Lead, LineItem, QuoteStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const DEFAULT_WARRANTY =
  '1 year workmanship warranty. 15 year manufacturer warranty on turf product.';

export default function QuoteBuilder() {
  const { leadId, id } = useParams<{ leadId?: string; id?: string }>();
  const navigate = useNavigate();

  const [lead, setLead] = useState<Lead | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [warrantyText, setWarrantyText] = useState(DEFAULT_WARRANTY);
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [quoteId, setQuoteId] = useState<string | null>(id ?? null);
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>('draft');
  const [sentAt, setSentAt] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

  const isStandalone = !id && !leadId;

  const subtotal = lineItems.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  const total = subtotal;

  const loadData = useCallback(async () => {
    try {
      if (id) {
        const quote = await fetchQuote(id);
        setLead(quote.lead ?? null);
        setLineItems(quote.line_items ?? []);
        setWarrantyText(quote.warranty_text ?? DEFAULT_WARRANTY);
        setNotes(quote.notes ?? '');
        setValidUntil(quote.valid_until ?? '');
        setQuoteStatus(quote.status);
        setSentAt(quote.sent_at);
      } else if (leadId) {
        const leadData = await fetchLead(leadId);
        setLead(leadData);
        setLineItems([createDefaultItem()]);
      } else {
        setLineItems([createDefaultItem()]);
      }
    } finally {
      setLoading(false);
    }
  }, [id, leadId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function ensureLead(): Promise<Lead> {
    if (lead) return lead;
    const created = await createLead({
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
      address: customerAddress,
      sqft: 0,
      estimate_min: total,
      estimate_max: total,
      notes: null,
      polygon_data: null,
      satellite_image_url: null,
      assigned_to: null,
      site_visit_date: null,
      install_date: null,
      source: 'quote',
    });
    setLead(created);
    return created;
  }

  async function handleSave() {
    if (isStandalone && !lead && !customerName.trim()) return;
    setSaving(true);
    try {
      const activeLead = await ensureLead();

      const payload = {
        line_items: lineItems,
        subtotal,
        total,
        warranty_text: warrantyText || null,
        notes: notes || null,
        valid_until: validUntil || null,
      };

      if (quoteId) {
        await updateQuote(quoteId, payload);
      } else {
        const created = await createQuote({
          lead_id: activeLead.id,
          line_items: lineItems,
          subtotal,
          total,
          warranty_text: warrantyText || undefined,
          notes: notes || undefined,
          valid_until: validUntil || undefined,
        });
        setQuoteId(created.id);
        window.history.replaceState(null, '', `/quotes/${created.id}/edit`);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (isStandalone && !lead && !customerName.trim()) return;
    setSending(true);
    try {
      const activeLead = await ensureLead();

      const payload = {
        line_items: lineItems,
        subtotal,
        total,
        warranty_text: warrantyText || null,
        notes: notes || null,
        valid_until: validUntil || null,
        status: 'sent' as QuoteStatus,
        sent_at: new Date().toISOString(),
      };

      let finalQuoteId = quoteId;

      if (quoteId) {
        await updateQuote(quoteId, payload);
      } else {
        const created = await createQuote({
          lead_id: activeLead.id,
          line_items: lineItems,
          subtotal,
          total,
          warranty_text: warrantyText || undefined,
          notes: notes || undefined,
          valid_until: validUntil || undefined,
        });
        finalQuoteId = created.id;
        setQuoteId(created.id);
      }

      if (finalQuoteId) {
        await supabase.functions.invoke('send-quote', {
          body: { quote_id: finalQuoteId },
        });
      }

      await updateLeadStatus(activeLead.id, 'quote_sent');

      navigate(`/leads/${activeLead.id}`);
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} />
      </div>
    );
  }

  const previewLead = lead ?? {
    id: '',
    name: customerName || 'Customer Name',
    email: customerEmail,
    phone: customerPhone,
    address: customerAddress || 'Address',
    sqft: 0,
    polygon_data: null,
    satellite_image_url: null,
    estimate_min: total,
    estimate_max: total,
    status: 'new_lead' as const,
    assigned_to: null,
    notes: null,
    site_visit_date: null,
    install_date: null,
    source: 'quote',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const quoteData = {
    line_items: lineItems,
    subtotal,
    total,
    warranty_text: warrantyText,
    notes,
    status: quoteStatus,
    sent_at: sentAt,
    valid_until: validUntil,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate(lead ? `/leads/${lead.id}` : -1 as unknown as string)
          }
        >
          <ArrowLeft size={16} />
          Back
        </Button>
        <h1 className="text-xl font-bold text-slate-900">
          {quoteId ? 'Edit Quote' : 'New Quote'}
        </h1>
      </div>

      <div className="flex gap-2 lg:hidden">
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            mobileTab === 'edit'
              ? 'bg-emerald-100 text-emerald-700'
              : 'text-slate-500 hover:bg-slate-100',
          )}
          onClick={() => setMobileTab('edit')}
        >
          <PenLine size={14} />
          Edit
        </button>
        <button
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            mobileTab === 'preview'
              ? 'bg-emerald-100 text-emerald-700'
              : 'text-slate-500 hover:bg-slate-100',
          )}
          onClick={() => setMobileTab('preview')}
        >
          <Eye size={14} />
          Preview
        </button>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div
          className={cn(
            'flex flex-1 flex-col gap-6',
            mobileTab !== 'edit' && 'hidden lg:flex',
          )}
        >
          {isStandalone && !lead && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">
                Customer Info
              </h2>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1">
                    <Input
                      label="Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Customer name"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      label="Email"
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="flex-1">
                    <Input
                      label="Phone"
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="(555) 555-5555"
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      label="Address"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="123 Main St, City, ST"
                    />
                  </div>
                </div>
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Line Items
            </h2>
            <LineItemEditor lineItems={lineItems} onChange={setLineItems} />
          </section>

          <section className="flex flex-col gap-4">
            <Textarea
              label="Warranty"
              value={warrantyText}
              onChange={(e) => setWarrantyText(e.target.value)}
              className="min-h-[60px]"
            />
            <Textarea
              label="Notes"
              placeholder="Additional notes for the customer..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[60px]"
            />
            <Input
              label="Valid Until"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-48"
            />
          </section>

          {quoteId && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-slate-700">
                Quote Views
              </h2>
              <QuoteViewTracker quoteId={quoteId} />
            </section>
          )}
        </div>

        <div
          className={cn(
            'w-full lg:w-[480px] lg:flex-shrink-0',
            mobileTab !== 'preview' && 'hidden lg:block',
          )}
        >
          <div className="sticky top-6">
            <QuotePreview
              quote={quoteData}
              lead={previewLead}
              quoteNumber={quoteId?.slice(0, 8).toUpperCase()}
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white py-4">
        <Button
          variant="secondary"
          onClick={handleSave}
          loading={saving}
          disabled={sending}
        >
          <Save size={16} />
          Save Draft
        </Button>
        <Button onClick={handleSend} loading={sending} disabled={saving}>
          <Send size={16} />
          Send Quote
        </Button>
      </div>
    </div>
  );
}
