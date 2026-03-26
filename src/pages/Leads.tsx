import { Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function Leads() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <Button variant="primary">
          <Plus size={16} />
          Add Lead
        </Button>
      </div>
      <div className="mt-6">
        <EmptyState
          icon={Users}
          title="No leads yet"
          description="New leads from your website will show up here."
        />
      </div>
    </div>
  );
}
