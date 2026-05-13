import { useMemo } from 'react';
import { DollarSign, FileText, Trophy, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Lead } from '@/lib/types';

// Whole-dollar formatter for the Revenue tile — cents on a monthly total
// don't add information and just clutter the card ("$32,000" reads cleaner
// than "$32,000.00"). Quote totals shown to customers keep cents via the
// shared formatCurrency in utils.
function formatRevenue(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

interface StatsCardsProps {
  leads: Lead[];
}

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor }: StatCardProps) {
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

function StatsCards({ leads }: StatsCardsProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonth = leads.filter((l) => new Date(l.created_at) >= monthStart);

    const newLeads = thisMonth.filter((l) => l.status === 'new_lead').length;

    const activeQuotes = leads.filter(
      (l) => l.status === 'quote_sent' || l.status === 'quote_viewed'
    ).length;

    const approvedStatuses = new Set([
      'quote_approved',
      'install_scheduled',
      'install_complete',
      'review_requested',
      'review_received',
      'closed',
    ]);

    const wonThisMonth = thisMonth.filter((l) => approvedStatuses.has(l.status)).length;

    const revenue = thisMonth
      .filter((l) => approvedStatuses.has(l.status))
      .reduce((sum, l) => sum + l.estimate_max, 0);

    return { newLeads, activeQuotes, wonThisMonth, revenue };
  }, [leads]);

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        label="New Leads"
        value={String(stats.newLeads)}
        icon={UserPlus}
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
      />
      <StatCard
        label="Active Quotes"
        value={String(stats.activeQuotes)}
        icon={FileText}
        iconBg="bg-blue-50"
        iconColor="text-blue-600"
      />
      <StatCard
        label="Won This Month"
        value={String(stats.wonThisMonth)}
        icon={Trophy}
        iconBg="bg-amber-50"
        iconColor="text-amber-600"
      />
      <StatCard
        label="Revenue"
        value={formatRevenue(stats.revenue)}
        icon={DollarSign}
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
      />
    </div>
  );
}

export { StatsCards };
