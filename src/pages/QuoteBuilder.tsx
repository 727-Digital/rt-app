import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookmarkPlus, Eye, FileStack, PenLine, Save, Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { Spinner } from '@/components/ui/Spinner';
import { LineItemEditor, createDefaultItem } from '@/components/quotes/LineItemEditor';
import { QuotePreview } from '@/components/quotes/QuotePreview';
import { QuoteViewTracker } from '@/components/quotes/QuoteViewTracker';
import { QuoteAttachmentsEditor } from '@/components/quotes/QuoteAttachmentsEditor';
import { fetchQuote, createQuote, updateQuote } from '@/lib/queries/quotes';
import { fetchLead, createLead, updateLeadStatus } from '@/lib/queries/leads';
import { createFollowUp } from '@/lib/queries/follow_ups';
import {
  fetchQuoteTemplates,
  createQuoteTemplate,
  deleteQuoteTemplate,
} from '@/lib/queries/quote_templates';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';
import { supabase } from '@/lib/supabase';
import type { Lead, LineItem, QuoteStatus, QuoteTemplate } from '@/lib/types';
import { cn, formatCurrency } from '@/lib/utils';

const DEFAULT_WARRANTY =
  '1 year workmanship warranty. 15 year manufacturer warranty on turf product.';

export default function QuoteBuilder() {
  const { orgId } = useAuth();
  const { org } = useOrg();
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

  const [materialsCost, setMaterialsCost] = useState(0);
  const [laborCost, setLaborCost] = useState(0);
  const [overheadCost, setOverheadCost] = useState(0);
  const [profitSplitPercent, setProfitSplitPercent] = useState(50);
  const [laborCostAutoFilled, setLaborCostAutoFilled] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [mobileTab, setMobileTab] = useState<'edit' | 'preview'>('edit');

  // ------------------------------------------------------------------
  // Quote templates — saved blueprints for common quotes (e.g. standard
  // 1000 sqft install) that pre-fill line items, warranty, cost defaults.
  // Templates live at the org level; any team member can apply or save.
  // ------------------------------------------------------------------
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  const isStandalone = !id && !leadId;

  const subtotal = lineItems.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  const total = subtotal;

  const profitCalc = useMemo(() => {
    const grossProfit = total - materialsCost - laborCost - overheadCost;
    const installerCut = grossProfit * (profitSplitPercent / 100);
    const reliableCut = grossProfit * (1 - profitSplitPercent / 100);
    return { grossProfit, installerCut, reliableCut };
  }, [total, materialsCost, laborCost, overheadCost, profitSplitPercent]);

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
        setMaterialsCost(quote.materials_cost ?? 0);
        setLaborCost(quote.labor_cost ?? 0);
        setOverheadCost(quote.overhead_cost ?? 0);
        setProfitSplitPercent(quote.profit_split_percent ?? 50);
      } else if (leadId) {
        const leadData = await fetchLead(leadId);
        setLead(leadData);
        setLineItems([createDefaultItem()]);
        if (leadData.sqft > 0 && org?.default_labor_rate_per_sqft) {
          setLaborCost(leadData.sqft * org.default_labor_rate_per_sqft);
          setLaborCostAutoFilled(true);
        }
        if (org?.default_profit_split != null) {
          setProfitSplitPercent(org.default_profit_split);
        }
      } else {
        setLineItems([createDefaultItem()]);
        if (org?.default_profit_split != null) {
          setProfitSplitPercent(org.default_profit_split);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, leadId, org?.default_labor_rate_per_sqft, org?.default_profit_split]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load org's quote templates once we know the org. Reused on save-template
  // so the dropdown refreshes with the new entry.
  const loadTemplates = useCallback(async () => {
    if (!orgId) return;
    try {
      const list = await fetchQuoteTemplates(orgId);
      setTemplates(list);
    } catch (err) {
      console.error('Failed to load quote templates:', err);
    }
  }, [orgId]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  function applyTemplate(t: QuoteTemplate) {
    // Clone line items so editing the form doesn't mutate the template row.
    setLineItems(
      t.line_items.map((item) => ({
        ...item,
        id: crypto.randomUUID(),
      })),
    );
    setWarrantyText(t.warranty_text ?? DEFAULT_WARRANTY);
    setNotes(t.notes ?? '');
    setMaterialsCost(t.materials_cost ?? 0);
    setLaborCost(t.labor_cost ?? 0);
    setLaborCostAutoFilled(false);
    setOverheadCost(t.overhead_cost ?? 0);
    setProfitSplitPercent(t.profit_split_percent ?? 50);
    // valid_until: if template has default_valid_days, set valid_until to today + N
    if (t.default_valid_days) {
      const d = new Date();
      d.setDate(d.getDate() + t.default_valid_days);
      setValidUntil(d.toISOString().slice(0, 10));
    }
  }

  async function handleSaveAsTemplate() {
    if (!orgId || !templateName.trim()) return;
    setSavingTemplate(true);
    try {
      await createQuoteTemplate({
        org_id: orgId,
        name: templateName.trim(),
        line_items: lineItems,
        warranty_text: warrantyText || null,
        notes: notes || null,
        default_valid_days: null,
        materials_cost: materialsCost,
        labor_cost: laborCost,
        overhead_cost: overheadCost,
        profit_split_percent: profitSplitPercent,
      });
      setTemplateName('');
      setShowSaveTemplate(false);
      await loadTemplates();
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('Delete this template? Existing quotes built from it are unaffected.')) return;
    await deleteQuoteTemplate(id);
    await loadTemplates();
  }

  async function ensureLead(): Promise<Lead> {
    if (lead) return lead;
    const created = await createLead({
      org_id: orgId!,
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

  // Same shape as ensureLead but for the quote row itself. Used by the
  // attachments editor so reps don't have to click "Save Draft" first
  // before they can upload a photo — they pick a file, we silently
  // create the draft, then proceed.
  async function ensureQuoteDraft(): Promise<string> {
    if (quoteId) return quoteId;
    if (!orgId) throw new Error('No organization context');
    const activeLead = await ensureLead();
    const created = await createQuote({
      org_id: orgId,
      lead_id: activeLead.id,
      line_items: lineItems,
      subtotal,
      total,
      warranty_text: warrantyText || undefined,
      notes: notes || undefined,
      valid_until: validUntil || undefined,
      materials_cost: materialsCost,
      labor_cost: laborCost,
      overhead_cost: overheadCost,
      profit_split_percent: profitSplitPercent,
    });
    setQuoteId(created.id);
    window.history.replaceState(null, '', `/quotes/${created.id}/edit`);
    return created.id;
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
        materials_cost: materialsCost,
        labor_cost: laborCost,
        overhead_cost: overheadCost,
        profit_split_percent: profitSplitPercent,
      };

      if (quoteId) {
        await updateQuote(quoteId, payload);
      } else {
        const created = await createQuote({
          org_id: orgId!,
          lead_id: activeLead.id,
          line_items: lineItems,
          subtotal,
          total,
          warranty_text: warrantyText || undefined,
          notes: notes || undefined,
          valid_until: validUntil || undefined,
          materials_cost: materialsCost,
          labor_cost: laborCost,
          overhead_cost: overheadCost,
          profit_split_percent: profitSplitPercent,
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
        materials_cost: materialsCost,
        labor_cost: laborCost,
        overhead_cost: overheadCost,
        profit_split_percent: profitSplitPercent,
        status: 'sent' as QuoteStatus,
        sent_at: new Date().toISOString(),
      };

      let finalQuoteId = quoteId;

      if (quoteId) {
        await updateQuote(quoteId, payload);
      } else {
        const created = await createQuote({
          org_id: orgId!,
          lead_id: activeLead.id,
          line_items: lineItems,
          subtotal,
          total,
          warranty_text: warrantyText || undefined,
          notes: notes || undefined,
          valid_until: validUntil || undefined,
          materials_cost: materialsCost,
          labor_cost: laborCost,
          overhead_cost: overheadCost,
          profit_split_percent: profitSplitPercent,
        });
        finalQuoteId = created.id;
        setQuoteId(created.id);
      }

      if (finalQuoteId) {
        await supabase.functions.invoke('send-quote', {
          body: { quote_id: finalQuoteId },
        });
      }

      const expiresAt = validUntil
        ? new Date(validUntil).toISOString()
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

      if (finalQuoteId) {
        await updateQuote(finalQuoteId, { expires_at: expiresAt });
      }

      await updateLeadStatus(activeLead.id, 'quote_sent');

      if (finalQuoteId) {
        const sentTime = Date.now();
        const expiresDate = new Date(expiresAt);
        const daysLeft = Math.max(0, Math.ceil((expiresDate.getTime() - sentTime) / (1000 * 60 * 60 * 24)));

        const followUps = [
          {
            scheduled_for: new Date(sentTime + 24 * 60 * 60 * 1000).toISOString(),
            body: `Hey ${activeLead.name}, just wanted to make sure you received the quote I sent over. Any questions? Feel free to reply to this text or give us a call.`,
          },
          {
            scheduled_for: new Date(sentTime + 72 * 60 * 60 * 1000).toISOString(),
            body: `Hi ${activeLead.name}, following up on your turf installation quote. The pricing in your quote is locked in for ${daysLeft} more days. Let us know if you'd like to move forward or have any questions!`,
          },
        ];

        await Promise.all(
          followUps.map((f) =>
            createFollowUp({
              lead_id: activeLead.id,
              quote_id: finalQuoteId!,
              org_id: orgId,
              type: 'quote_follow_up',
              scheduled_for: f.scheduled_for,
              channel: 'sms',
              body: f.body,
            }),
          ),
        ).catch(() => {});
      }

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
    // id + created_at are required by the new QuotePreview (used for the
    // displayed quote number + fallback date if not yet sent). Fall back
    // to the active quoteId in state or a placeholder so the preview
    // never breaks before the draft is saved.
    id: quoteId ?? '00000000-0000-0000-0000-000000000000',
    created_at: new Date().toISOString(),
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

          {/*
            Templates strip. Tap "Use" to populate the form from a saved
            blueprint, or "Save as template" to capture the current state.
            Hidden when the quote is already sent / approved (editing a
            historical quote should be deliberate).
          */}
          {quoteStatus === 'draft' && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <FileStack size={14} />
                Templates
              </h2>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                {templates.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        className="group inline-flex items-stretch overflow-hidden rounded-full border border-emerald-200 bg-white"
                      >
                        <button
                          type="button"
                          onClick={() => applyTemplate(t)}
                          className="px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                          title={`Apply "${t.name}"`}
                        >
                          {t.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(t.id)}
                          className="border-l border-emerald-200 px-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Delete template ${t.name}`}
                          title="Delete template"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSaveTemplate(true)}
                  disabled={lineItems.length === 0}
                  className="text-emerald-700 hover:bg-emerald-100"
                >
                  <BookmarkPlus size={14} />
                  Save current as template
                </Button>
                {templates.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    No templates yet. Build a quote you'll re-use, then save it.
                  </p>
                )}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Line Items
            </h2>
            <LineItemEditor lineItems={lineItems} onChange={setLineItems} />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold text-slate-700">
              Job Costs & Profit
            </h2>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="relative">
                  <Input
                    label="Materials Cost"
                    type="number"
                    min={0}
                    step={0.01}
                    value={materialsCost || ''}
                    onChange={(e) => setMaterialsCost(parseFloat(e.target.value) || 0)}
                    className="pl-7"
                  />
                  <span className="pointer-events-none absolute bottom-2.5 left-3 text-sm text-slate-400">$</span>
                </div>
                <div className="relative">
                  <Input
                    label={laborCostAutoFilled ? `Labor Cost (auto: ${lead?.sqft ?? 0} sqft)` : 'Labor Cost'}
                    type="number"
                    min={0}
                    step={0.01}
                    value={laborCost || ''}
                    onChange={(e) => {
                      setLaborCost(parseFloat(e.target.value) || 0);
                      setLaborCostAutoFilled(false);
                    }}
                    className="pl-7"
                  />
                  <span className="pointer-events-none absolute bottom-2.5 left-3 text-sm text-slate-400">$</span>
                </div>
                <div className="relative">
                  <Input
                    label="Overhead"
                    type="number"
                    min={0}
                    step={0.01}
                    value={overheadCost || ''}
                    onChange={(e) => setOverheadCost(parseFloat(e.target.value) || 0)}
                    className="pl-7"
                  />
                  <span className="pointer-events-none absolute bottom-2.5 left-3 text-sm text-slate-400">$</span>
                </div>
                <div className="relative">
                  <Input
                    label="Profit Split %"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={profitSplitPercent}
                    onChange={(e) => setProfitSplitPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                    className="pr-7"
                  />
                  <span className="pointer-events-none absolute bottom-2.5 right-3 text-sm text-slate-400">%</span>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-1.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Quote Total</span>
                    <span className="font-semibold text-slate-900">{formatCurrency(total)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-red-600">Materials</span>
                    <span className="text-red-600">-{formatCurrency(materialsCost)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-red-600">Labor</span>
                    <span className="text-red-600">-{formatCurrency(laborCost)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-red-600">Overhead</span>
                    <span className="text-red-600">-{formatCurrency(overheadCost)}</span>
                  </div>
                  <div className="my-1 border-t border-dashed border-slate-200" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-emerald-700">Gross Profit</span>
                    <span className={cn(
                      'font-semibold',
                      profitCalc.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600',
                    )}>{formatCurrency(profitCalc.grossProfit)}</span>
                  </div>
                  <div className="flex items-center justify-between pl-3">
                    <span className="text-emerald-600">Installer ({profitSplitPercent}%)</span>
                    <span className="text-emerald-600">{formatCurrency(profitCalc.installerCut)}</span>
                  </div>
                  <div className="flex items-center justify-between pl-3">
                    <span className="text-emerald-600">Reliable ({100 - profitSplitPercent}%)</span>
                    <span className="text-emerald-600">{formatCurrency(profitCalc.reliableCut)}</span>
                  </div>
                </div>
              </div>
            </div>
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

          <QuoteAttachmentsEditor
            quoteId={quoteId}
            orgId={orgId}
            ensureQuoteDraft={ensureQuoteDraft}
          />

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
              branding={org ? { name: org.name, logo_url: org.logo_url, primary_color: org.primary_color } : undefined}
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

      <Modal
        open={showSaveTemplate}
        onClose={() => !savingTemplate && setShowSaveTemplate(false)}
        title="Save quote as template"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Saves the current line items, warranty, notes, and cost defaults as a
            reusable template. The customer info on this quote is NOT included.
          </p>
          <Input
            label="Template name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder='e.g. "Standard 1000 sqft install"'
            autoFocus
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowSaveTemplate(false)}
              disabled={savingTemplate}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              size="md"
              onClick={handleSaveAsTemplate}
              loading={savingTemplate}
              disabled={!templateName.trim()}
              className="flex-1"
            >
              <Save size={16} />
              Save template
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
