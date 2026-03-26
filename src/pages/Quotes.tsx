import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import type { Quote, QuoteStatus } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const STATUS_CONFIG: Record<QuoteStatus, { label: string; variant: BadgeVariant }> = {
  draft: { label: 'Draft', variant: 'slate' },
  sent: { label: 'Sent', variant: 'blue' },
  viewed: { label: 'Viewed', variant: 'amber' },
  approved: { label: 'Approved', variant: 'emerald' },
  rejected: { label: 'Rejected', variant: 'slate' },
};

export default function Quotes() {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchQuotes();
  }, []);

  async function fetchQuotes() {
    setLoading(true);
    const { data } = await supabase
      .from('quotes')
      .select('*, lead:leads(name, address, phone, email)')
      .order('created_at', { ascending: false });
    setQuotes((data as Quote[]) ?? []);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    let result = quotes;
    if (statusFilter !== 'all') {
      result = result.filter((q) => q.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (quote) =>
          (quote.lead as any)?.name?.toLowerCase().includes(q) ||
          (quote.lead as any)?.address?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [quotes, search, statusFilter]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Quotes</h1>
        <Button variant="primary" onClick={() => navigate('/quotes/new')}>
          <Plus size={16} />
          Create Quote
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search quotes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-full sm:w-52">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([key, { label }]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No quotes found"
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Create your first quote to get started.'
            }
            action={
              !search && statusFilter === 'all' ? (
                <Button variant="primary" onClick={() => navigate('/quotes/new')}>
                  <Plus size={16} />
                  Create Quote
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="pb-3 font-medium text-slate-500">Customer</th>
                    <th className="pb-3 font-medium text-slate-500">Address</th>
                    <th className="pb-3 font-medium text-slate-500">Total</th>
                    <th className="pb-3 font-medium text-slate-500">Status</th>
                    <th className="pb-3 font-medium text-slate-500">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((quote) => (
                    <tr
                      key={quote.id}
                      className="border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => navigate(`/quotes/${quote.id}/edit`)}
                    >
                      <td className="py-3 font-medium text-slate-900">
                        {(quote.lead as any)?.name ?? 'Unknown'}
                      </td>
                      <td className="py-3 text-slate-600">
                        {(quote.lead as any)?.address ?? '—'}
                      </td>
                      <td className="py-3 font-medium text-slate-900 whitespace-nowrap">
                        {formatCurrency(quote.total)}
                      </td>
                      <td className="py-3">
                        <Badge variant={STATUS_CONFIG[quote.status]?.variant ?? 'slate'}>
                          {STATUS_CONFIG[quote.status]?.label ?? quote.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-slate-500 whitespace-nowrap">{formatDate(quote.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 lg:hidden">
              {filtered.map((quote) => (
                <Card key={quote.id} onClick={() => navigate(`/quotes/${quote.id}/edit`)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">
                        {(quote.lead as any)?.name ?? 'Unknown'}
                      </p>
                      <p className="text-sm text-slate-500 truncate">
                        {(quote.lead as any)?.address ?? '—'}
                      </p>
                    </div>
                    <Badge variant={STATUS_CONFIG[quote.status]?.variant ?? 'slate'}>
                      {STATUS_CONFIG[quote.status]?.label ?? quote.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium text-slate-900 text-sm">{formatCurrency(quote.total)}</span>
                    <span>{formatDate(quote.created_at)}</span>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
