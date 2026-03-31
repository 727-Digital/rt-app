import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpDown,
  DollarSign,
  FileText,
  Percent,
  PiggyBank,
  TrendingUp,
} from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/hooks/useAuth';
import {
  fetchDeals,
  fetchFinancialSummary,
  fetchOrganizationOptions,
  type DealFilters,
  type DealRow,
  type FinancialSummary,
} from '@/lib/queries/financials';
import type { PaymentStatus } from '@/lib/types';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

type SortField = 'createdAt' | 'total' | 'grossProfit';
type SortDir = 'asc' | 'desc';

const PAYMENT_BADGE: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  unpaid: { label: 'Unpaid', variant: 'amber' },
  partial: { label: 'Partial', variant: 'amber' },
  paid: { label: 'Paid', variant: 'emerald' },
  refunded: { label: 'Refunded', variant: 'red' },
};

function StatCard({
  label,
  value,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', iconBg)}>
        <Icon size={20} className={iconColor} />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export default function Financials() {
  const { orgId, isPlatformAdmin } = useAuth();

  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterOrg, setFilterOrg] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | ''>('');
  const [filterDate, setFilterDate] = useState<DealFilters['dateRange']>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const effectiveOrgId = isPlatformAdmin ? (filterOrg || undefined) : orgId ?? undefined;

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const filters: DealFilters = {
          orgId: effectiveOrgId,
          paymentStatus: filterStatus || undefined,
          dateRange: filterDate,
        };

        const [s, d] = await Promise.all([
          fetchFinancialSummary(effectiveOrgId),
          fetchDeals(filters),
        ]);
        setSummary(s);
        setDeals(d);

        if (isPlatformAdmin && orgs.length === 0) {
          const orgList = await fetchOrganizationOptions();
          setOrgs(orgList);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [effectiveOrgId, filterStatus, filterDate, isPlatformAdmin]);

  const sortedDeals = useMemo(() => {
    const sorted = [...deals].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'createdAt') {
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else if (sortField === 'total') {
        cmp = a.total - b.total;
      } else {
        cmp = a.grossProfit - b.grossProfit;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [deals, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={32} />
      </div>
    );
  }

  const isRepView = !isPlatformAdmin;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Financials</h1>
      <p className="mt-1 text-slate-500">
        {isRepView ? 'Your financial overview' : 'Revenue, costs, and profit breakdown'}
      </p>

      {summary && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total Revenue"
              value={formatCurrency(summary.totalRevenue)}
              icon={DollarSign}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
            />
            <StatCard
              label="Total Profit"
              value={formatCurrency(summary.totalProfit)}
              icon={TrendingUp}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              label={isRepView ? 'Your Profit' : 'Your Cut'}
              value={formatCurrency(isRepView ? summary.totalProfit - summary.yourCut : summary.yourCut)}
              icon={PiggyBank}
              iconBg="bg-amber-50"
              iconColor="text-amber-600"
            />
            <StatCard
              label="Avg Profit Margin"
              value={`${summary.avgProfitMargin.toFixed(1)}%`}
              icon={Percent}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
            />
          </div>

          <div className="mt-6">
            <h2 className="text-sm font-semibold text-slate-900">Pipeline Forecast</h2>
            <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card>
                <p className="text-xs font-medium text-slate-400">Quotes Sent</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{summary.quotesSent.count}</p>
                <p className="text-sm text-slate-500">{formatCurrency(summary.quotesSent.value)}</p>
              </Card>
              <Card>
                <p className="text-xs font-medium text-slate-400">Approved (Awaiting Payment)</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{summary.quotesApproved.count}</p>
                <p className="text-sm text-slate-500">{formatCurrency(summary.quotesApproved.value)}</p>
              </Card>
              <Card>
                <p className="text-xs font-medium text-slate-400">Paid</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{summary.quotesPaid.count}</p>
                <p className="text-sm text-emerald-600">{formatCurrency(summary.quotesPaid.value)}</p>
              </Card>
              <Card>
                <p className="text-xs font-medium text-slate-400">Close Rate</p>
                <p className="mt-1 text-xl font-bold text-slate-900">{summary.closeRate.toFixed(0)}%</p>
                <p className="text-sm text-slate-500">approved / total decided</p>
              </Card>
            </div>
          </div>
        </>
      )}

      <div className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Deals</h2>
          <div className="flex flex-wrap items-center gap-2">
            {isPlatformAdmin && (
              <select
                value={filterOrg}
                onChange={(e) => setFilterOrg(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Organizations</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            )}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as PaymentStatus | '')}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
              <option value="refunded">Refunded</option>
            </select>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value as DealFilters['dateRange'])}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
            </select>
          </div>
        </div>

        {deals.length === 0 && !loading ? (
          <div className="mt-6 flex flex-col items-center justify-center py-16">
            <FileText size={48} className="text-slate-300" />
            <h3 className="mt-4 text-base font-medium text-slate-900">No deals found</h3>
            <p className="mt-1 text-sm text-slate-500">Adjust your filters or create quotes to see financial data.</p>
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Lead</th>
                  {isPlatformAdmin && <th className="px-4 py-3">Org</th>}
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-slate-600"
                    onClick={() => toggleSort('total')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Total
                      <ArrowUpDown size={12} />
                    </span>
                  </th>
                  <th className="px-4 py-3">Costs</th>
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-slate-600"
                    onClick={() => toggleSort('grossProfit')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Profit
                      <ArrowUpDown size={12} />
                    </span>
                  </th>
                  <th className="px-4 py-3">{isRepView ? 'Your Cut' : 'Split'}</th>
                  <th className="px-4 py-3">Status</th>
                  <th
                    className="cursor-pointer px-4 py-3 hover:text-slate-600"
                    onClick={() => toggleSort('createdAt')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Date
                      <ArrowUpDown size={12} />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDeals.map((deal) => {
                  const badge = PAYMENT_BADGE[deal.paymentStatus];
                  return (
                    <tr key={deal.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{deal.leadName}</td>
                      {isPlatformAdmin && (
                        <td className="px-4 py-3 text-slate-600">{deal.orgName}</td>
                      )}
                      <td className="px-4 py-3 text-slate-900">{formatCurrency(deal.total)}</td>
                      <td className="px-4 py-3 text-red-600">
                        {formatCurrency(deal.materialsCost + deal.laborCost + deal.overheadCost)}
                      </td>
                      <td className={cn(
                        'px-4 py-3 font-medium',
                        deal.grossProfit >= 0 ? 'text-emerald-700' : 'text-red-600',
                      )}>
                        {formatCurrency(deal.grossProfit)}
                      </td>
                      <td className="px-4 py-3">
                        {isRepView ? (
                          <span className="text-emerald-600">{formatCurrency(deal.installerCut)}</span>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-slate-600">{formatCurrency(deal.installerCut)}</span>
                            <span className="text-emerald-600">{formatCurrency(deal.yourCut)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(deal.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
