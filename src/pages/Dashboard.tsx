import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Star, TrendingUp } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { KanbanBoard } from '@/components/dashboard/KanbanBoard';
import { supabase } from '@/lib/supabase';
import type { Review } from '@/lib/types';

function useReviewStats() {
  const [requested, setRequested] = useState(0);
  const [collected, setCollected] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from('reviews').select('status');
        const all = (data ?? []) as Pick<Review, 'status'>[];
        setRequested(all.length);
        setCollected(all.filter((r) => r.status === 'completed').length);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const rate = requested > 0 ? Math.round((collected / requested) * 100) : 0;
  return { requested, collected, rate, loading };
}

export default function Dashboard() {
  const { leads, loading } = useLeads();
  const navigate = useNavigate();
  const reviewStats = useReviewStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-slate-500">Lead pipeline at a glance</p>

      {leads.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={LayoutDashboard}
            title="No leads yet"
            description="Leads will appear here when customers submit quotes from your website."
          />
        </div>
      ) : (
        <>
          <div className="mt-6">
            <StatsCards leads={leads} />
          </div>
          <div className="mt-6">
            <KanbanBoard leads={leads} onLeadClick={(lead) => navigate(`/leads/${lead.id}`)} />
          </div>

          {!reviewStats.loading && reviewStats.requested > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-900">Reviews</h2>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <Card className="flex flex-col items-center py-3">
                  <MessageSquare size={16} className="text-blue-500" />
                  <p className="mt-1 text-2xl font-bold text-slate-900">{reviewStats.requested}</p>
                  <p className="text-xs text-slate-500">Requested</p>
                </Card>
                <Card className="flex flex-col items-center py-3">
                  <Star size={16} className="text-amber-400" />
                  <p className="mt-1 text-2xl font-bold text-slate-900">{reviewStats.collected}</p>
                  <p className="text-xs text-slate-500">Collected</p>
                </Card>
                <Card className="flex flex-col items-center py-3">
                  <TrendingUp size={16} className="text-emerald-500" />
                  <p className="mt-1 text-2xl font-bold text-slate-900">{reviewStats.rate}%</p>
                  <p className="text-xs text-slate-500">Collection Rate</p>
                </Card>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
