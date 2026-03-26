import { useNavigate } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';
import { useLeads } from '@/hooks/useLeads';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { KanbanBoard } from '@/components/dashboard/KanbanBoard';

export default function Dashboard() {
  const { leads, loading } = useLeads();
  const navigate = useNavigate();

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
        </>
      )}
    </div>
  );
}
