import { useMemo } from 'react';
import { TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { Lead } from '@/lib/types';
import { cn } from '@/lib/utils';

interface WinLossCardProps {
  leads: Lead[];
}

function WinLossCard({ leads }: WinLossCardProps) {
  const analysis = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const closedLeads = leads.filter((l) => l.status === 'closed');
    const won = closedLeads.filter((l) => !l.loss_reason);
    const lost = closedLeads.filter((l) => !!l.loss_reason);

    const thisMonthClosed = closedLeads.filter((l) => new Date(l.updated_at) >= thisMonthStart);
    const lastMonthClosed = closedLeads.filter(
      (l) => new Date(l.updated_at) >= lastMonthStart && new Date(l.updated_at) < thisMonthStart,
    );

    const thisMonthWon = thisMonthClosed.filter((l) => !l.loss_reason).length;
    const thisMonthLost = thisMonthClosed.filter((l) => !!l.loss_reason).length;
    const lastMonthWon = lastMonthClosed.filter((l) => !l.loss_reason).length;
    const lastMonthLost = lastMonthClosed.filter((l) => !!l.loss_reason).length;

    const totalDecided = won.length + lost.length;
    const winRate = totalDecided > 0 ? Math.round((won.length / totalDecided) * 100) : 0;

    const thisMonthTotal = thisMonthWon + thisMonthLost;
    const lastMonthTotal = lastMonthWon + lastMonthLost;
    const thisMonthRate = thisMonthTotal > 0 ? Math.round((thisMonthWon / thisMonthTotal) * 100) : 0;
    const lastMonthRate = lastMonthTotal > 0 ? Math.round((lastMonthWon / lastMonthTotal) * 100) : 0;

    const lossReasons: Record<string, number> = {};
    for (const l of lost) {
      const reason = l.loss_reason || 'Unknown';
      lossReasons[reason] = (lossReasons[reason] || 0) + 1;
    }
    const topReasons = Object.entries(lossReasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      won: won.length,
      lost: lost.length,
      winRate,
      thisMonthRate,
      lastMonthRate,
      topReasons,
    };
  }, [leads]);

  if (analysis.won + analysis.lost === 0) return null;

  const rateDiff = analysis.thisMonthRate - analysis.lastMonthRate;

  return (
    <div>
      <h2 className="text-sm font-semibold text-slate-900">Win/Loss Analysis</h2>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">Win Rate</h3>
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">{analysis.winRate}%</p>
          <p className="mt-1 text-xs text-slate-500">
            {analysis.won} won / {analysis.lost} lost
          </p>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-slate-500">This month: {analysis.thisMonthRate}%</span>
            {rateDiff !== 0 && (
              <span className={cn(
                'flex items-center gap-0.5 text-xs font-medium',
                rateDiff > 0 ? 'text-emerald-600' : 'text-red-600',
              )}>
                {rateDiff > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {rateDiff > 0 ? '+' : ''}{rateDiff}% vs last month
              </span>
            )}
          </div>
        </Card>

        {analysis.topReasons.length > 0 && (
          <Card>
            <h3 className="text-sm font-semibold text-slate-900">Top Loss Reasons</h3>
            <div className="mt-2 flex flex-col gap-2">
              {analysis.topReasons.map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 truncate">{reason}</span>
                  <span className="ml-2 flex-shrink-0 font-medium text-slate-900">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

export { WinLossCard };
