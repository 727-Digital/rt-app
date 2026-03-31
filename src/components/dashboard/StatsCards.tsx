import { useMemo } from 'react';
import { Clock, DollarSign, FileText, Trophy, UserPlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { Lead } from '@/lib/types';

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

    const responseTimes = leads
      .filter((l) => l.response_time_seconds != null)
      .map((l) => l.response_time_seconds!);
    const avgResponseSeconds = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

    return { newLeads, activeQuotes, wonThisMonth, revenue, avgResponseSeconds };
  }, [leads]);

  const responseTimeStr = stats.avgResponseSeconds != null
    ? stats.avgResponseSeconds < 60
      ? `${stats.avgResponseSeconds}s`
      : stats.avgResponseSeconds < 3600
        ? `${Math.round(stats.avgResponseSeconds / 60)} min`
        : `${Math.floor(stats.avgResponseSeconds / 3600)} hr ${Math.round((stats.avgResponseSeconds % 3600) / 60)} min`
    : 'N/A';

  const responseIconBg = stats.avgResponseSeconds != null
    ? stats.avgResponseSeconds < 300 ? 'bg-emerald-50' : stats.avgResponseSeconds < 1800 ? 'bg-amber-50' : 'bg-red-50'
    : 'bg-slate-50';
  const responseIconColor = stats.avgResponseSeconds != null
    ? stats.avgResponseSeconds < 300 ? 'text-emerald-600' : stats.avgResponseSeconds < 1800 ? 'text-amber-600' : 'text-red-600'
    : 'text-slate-400';

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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
        value={formatCurrency(stats.revenue)}
        icon={DollarSign}
        iconBg="bg-emerald-50"
        iconColor="text-emerald-600"
      />
      <StatCard
        label="Avg Response Time"
        value={responseTimeStr}
        icon={Clock}
        iconBg={responseIconBg}
        iconColor={responseIconColor}
      />
    </div>
  );
}

export { StatsCards };
