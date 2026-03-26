import { LayoutDashboard } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-slate-500">Lead pipeline at a glance</p>
      <div className="mt-6">
        <EmptyState
          icon={LayoutDashboard}
          title="No leads yet"
          description="Leads will appear here when customers submit quotes from your website."
        />
      </div>
    </div>
  );
}
