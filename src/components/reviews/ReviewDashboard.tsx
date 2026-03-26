import { useEffect, useState } from 'react';
import { BarChart3, CheckCircle2, Clock, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import type { Review } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';

interface ReviewStats {
  total: number;
  completed: number;
  responseRate: number;
  avgDays: number | null;
}

const STATUS_ICON: Record<Review['status'], { icon: typeof Send; color: string }> = {
  pending: { icon: Clock, color: 'text-slate-400' },
  sent: { icon: Send, color: 'text-blue-500' },
  clicked: { icon: BarChart3, color: 'text-amber-500' },
  completed: { icon: CheckCircle2, color: 'text-emerald-500' },
};

function ReviewDashboard() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<ReviewStats>({ total: 0, completed: 0, responseRate: 0, avgDays: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;
        const all = (data ?? []) as Review[];
        setReviews(all);

        const total = all.length;
        const completed = all.filter((r) => r.status === 'completed').length;
        const responseRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        let avgDays: number | null = null;
        const withTimes = all.filter((r) => r.sent_at && r.completed_at);
        if (withTimes.length > 0) {
          const totalMs = withTimes.reduce((acc, r) => {
            return acc + (new Date(r.completed_at!).getTime() - new Date(r.sent_at!).getTime());
          }, 0);
          avgDays = Math.round(totalMs / withTimes.length / (1000 * 60 * 60 * 24) * 10) / 10;
        }

        setStats({ total, completed, responseRate, avgDays });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  if (loading) {
    return (
      <Card>
        <div className="flex justify-center py-8">
          <Spinner size={24} />
        </div>
      </Card>
    );
  }

  const recent = reviews.slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Requested" value={stats.total} />
        <StatCard label="Received" value={stats.completed} />
        <StatCard label="Response Rate" value={`${stats.responseRate}%`} />
        <StatCard label="Avg Response" value={stats.avgDays !== null ? `${stats.avgDays}d` : '--'} />
      </div>

      {recent.length > 0 && (
        <Card>
          <h4 className="text-sm font-semibold text-slate-900">Recent Review Requests</h4>
          <div className="mt-3 flex flex-col divide-y divide-slate-100">
            {recent.map((r) => {
              const cfg = STATUS_ICON[r.status];
              const Icon = cfg.icon;
              return (
                <div key={r.id} className="flex items-center gap-3 py-2">
                  <Icon size={16} className={cfg.color} />
                  <span className="text-sm text-slate-600 capitalize">{r.status}</span>
                  <span className="ml-auto text-xs text-slate-400">
                    {formatRelativeTime(r.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="flex flex-col items-center justify-center py-3">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </Card>
  );
}

export { ReviewDashboard };
