import { supabase } from '@/lib/supabase';
import type { PaymentStatus, Quote } from '@/lib/types';

export interface FinancialSummary {
  totalRevenue: number;
  totalProfit: number;
  yourCut: number;
  avgProfitMargin: number;
  quotesSent: { count: number; value: number };
  quotesApproved: { count: number; value: number };
  quotesPaid: { count: number; value: number };
  closeRate: number;
}

export interface DealRow {
  id: string;
  leadName: string;
  orgName: string;
  total: number;
  materialsCost: number;
  laborCost: number;
  overheadCost: number;
  grossProfit: number;
  installerCut: number;
  yourCut: number;
  paymentStatus: PaymentStatus;
  profitSplitPercent: number;
  createdAt: string;
}

export interface DealFilters {
  orgId?: string;
  paymentStatus?: PaymentStatus;
  dateRange?: 'this_month' | 'last_month' | 'all';
}

export async function fetchFinancialSummary(orgId?: string): Promise<FinancialSummary> {
  let query = supabase
    .from('quotes')
    .select('total, materials_cost, labor_cost, overhead_cost, profit_split_percent, payment_status, status, org_id');

  if (orgId) {
    query = query.eq('org_id', orgId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const quotes = (data ?? []) as Pick<Quote, 'total' | 'materials_cost' | 'labor_cost' | 'overhead_cost' | 'profit_split_percent' | 'payment_status' | 'status' | 'org_id'>[];

  const paid = quotes.filter((q) => q.payment_status === 'paid');
  const totalRevenue = paid.reduce((sum, q) => sum + (q.total ?? 0), 0);

  let totalProfit = 0;
  let yourCut = 0;
  let marginSum = 0;

  for (const q of paid) {
    const gross = (q.total ?? 0) - (q.materials_cost ?? 0) - (q.labor_cost ?? 0) - (q.overhead_cost ?? 0);
    const split = q.profit_split_percent ?? 50;
    totalProfit += gross;
    yourCut += gross * (1 - split / 100);
    if (q.total > 0) {
      marginSum += (gross / q.total) * 100;
    }
  }

  const avgProfitMargin = paid.length > 0 ? marginSum / paid.length : 0;

  const sent = quotes.filter((q) => q.status === 'sent' || q.status === 'viewed');
  const approved = quotes.filter((q) => q.status === 'approved' && q.payment_status !== 'paid');
  const paidQuotes = quotes.filter((q) => q.payment_status === 'paid');
  const rejected = quotes.filter((q) => q.status === 'rejected');

  const closeRate = (approved.length + paidQuotes.length + rejected.length) > 0
    ? ((approved.length + paidQuotes.length) / (approved.length + paidQuotes.length + rejected.length)) * 100
    : 0;

  return {
    totalRevenue,
    totalProfit,
    yourCut,
    avgProfitMargin,
    quotesSent: { count: sent.length, value: sent.reduce((s, q) => s + (q.total ?? 0), 0) },
    quotesApproved: { count: approved.length, value: approved.reduce((s, q) => s + (q.total ?? 0), 0) },
    quotesPaid: { count: paidQuotes.length, value: totalRevenue },
    closeRate,
  };
}

export async function fetchDeals(filters: DealFilters): Promise<DealRow[]> {
  let query = supabase
    .from('quotes')
    .select('id, total, materials_cost, labor_cost, overhead_cost, profit_split_percent, payment_status, created_at, lead:leads(name), organization:organizations(name)')
    .order('created_at', { ascending: false });

  if (filters.orgId) {
    query = query.eq('org_id', filters.orgId);
  }

  if (filters.paymentStatus) {
    query = query.eq('payment_status', filters.paymentStatus);
  }

  if (filters.dateRange === 'this_month') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    query = query.gte('created_at', start);
  } else if (filters.dateRange === 'last_month') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    query = query.gte('created_at', start).lt('created_at', end);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const total = (row.total as number) ?? 0;
    const mc = (row.materials_cost as number) ?? 0;
    const lc = (row.labor_cost as number) ?? 0;
    const oc = (row.overhead_cost as number) ?? 0;
    const split = (row.profit_split_percent as number) ?? 50;
    const gross = total - mc - lc - oc;

    const lead = row.lead as { name: string } | null;
    const org = row.organization as { name: string } | null;

    return {
      id: row.id as string,
      leadName: lead?.name ?? 'Unknown',
      orgName: org?.name ?? 'Unknown',
      total,
      materialsCost: mc,
      laborCost: lc,
      overheadCost: oc,
      grossProfit: gross,
      installerCut: gross * (split / 100),
      yourCut: gross * (1 - split / 100),
      paymentStatus: (row.payment_status as PaymentStatus) ?? 'unpaid',
      profitSplitPercent: split,
      createdAt: row.created_at as string,
    };
  });
}

export async function fetchOrganizationOptions() {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name')
    .order('name');

  if (error) throw error;
  return data as { id: string; name: string }[];
}
