import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function QuoteBuilder() {
  const { leadId, id } = useParams<{ leadId?: string; id?: string }>();
  const navigate = useNavigate();

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} />
        Back
      </Button>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Quote Builder</h1>
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6">
        <p className="text-slate-600">
          {id ? `Editing quote #${id}` : `Building quote for lead #${leadId}`}
        </p>
      </div>
    </div>
  );
}
