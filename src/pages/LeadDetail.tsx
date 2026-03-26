import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();

  return (
    <div>
      <Link to="/leads">
        <Button variant="ghost" size="sm">
          <ArrowLeft size={16} />
          Back to Leads
        </Button>
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Lead Details</h1>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-slate-600">Lead #{id}</p>
      </div>
    </div>
  );
}
