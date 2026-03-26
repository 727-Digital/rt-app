import { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import type { QuoteView } from '@/lib/types';
import { format, parseISO } from 'date-fns';

interface QuoteViewTrackerProps {
  quoteId: string;
}

function QuoteViewTracker({ quoteId }: QuoteViewTrackerProps) {
  const [views, setViews] = useState<QuoteView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('quote_views')
        .select('*')
        .eq('quote_id', quoteId)
        .order('viewed_at', { ascending: false });

      setViews((data as QuoteView[]) ?? []);
      setLoading(false);
    }
    load();
  }, [quoteId]);

  if (loading) return <Spinner size={16} />;

  if (views.length === 0) {
    return (
      <p className="text-xs text-slate-400">No views yet</p>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {views.map((v) => {
        const dt = parseISO(v.viewed_at);
        return (
          <div key={v.id} className="flex items-center gap-2 text-xs text-slate-500">
            <Eye size={12} className="text-slate-400" />
            <span>
              Viewed on {format(dt, 'MMM d, yyyy')} at {format(dt, 'h:mm a')}
            </span>
            {v.ip_address && (
              <span className="text-slate-400">({v.ip_address})</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { QuoteViewTracker };
