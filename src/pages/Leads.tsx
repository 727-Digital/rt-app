import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { LeadForm, type LeadFormData } from '@/components/leads/LeadForm';
import { useLeads } from '@/hooks/useLeads';
import { createLead } from '@/lib/queries/leads';
import { LEAD_STATUS_CONFIG, PIPELINE_STAGES, type LeadStatus } from '@/lib/types';
import { formatCurrency, formatDate, formatSqft } from '@/lib/utils';

const STATUS_BADGE_MAP: Record<string, BadgeVariant> = {
  'bg-emerald-100 text-emerald-800': 'emerald',
  'bg-blue-100 text-blue-800': 'blue',
  'bg-amber-100 text-amber-800': 'amber',
  'bg-slate-100 text-slate-800': 'slate',
};

function getStatusBadgeVariant(status: LeadStatus): BadgeVariant {
  const color = LEAD_STATUS_CONFIG[status].color;
  return STATUS_BADGE_MAP[color] ?? 'slate';
}

export default function Leads() {
  const { leads, loading, refetch } = useLeads();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    let result = leads;

    if (statusFilter !== 'all') {
      result = result.filter((l) => l.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.email.toLowerCase().includes(q) ||
          l.phone.toLowerCase().includes(q) ||
          l.address.toLowerCase().includes(q),
      );
    }

    return result;
  }, [leads, search, statusFilter]);

  async function handleCreate(data: LeadFormData) {
    try {
      setCreating(true);
      await createLead({
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        sqft: data.sqft,
        estimate_min: data.estimate_min,
        estimate_max: data.estimate_max,
        notes: data.notes || null,
        polygon_data: null,
        satellite_image_url: null,
        assigned_to: null,
        site_visit_date: null,
        install_date: null,
        source: 'manual',
      });
      setFormOpen(false);
      refetch();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
        <Button variant="primary" onClick={() => setFormOpen(true)}>
          <Plus size={16} />
          Add Lead
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-full sm:w-52">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {PIPELINE_STAGES.map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_CONFIG[s].label}
              </option>
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
            icon={Users}
            title="No leads found"
            description={
              search || statusFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'New leads from your website will show up here.'
            }
            action={
              !search && statusFilter === 'all' ? (
                <Button variant="primary" onClick={() => setFormOpen(true)}>
                  <Plus size={16} />
                  Add Lead
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
                    <th className="pb-3 font-medium text-slate-500">Name</th>
                    <th className="pb-3 font-medium text-slate-500">Address</th>
                    <th className="pb-3 font-medium text-slate-500">Sqft</th>
                    <th className="pb-3 font-medium text-slate-500">Estimate</th>
                    <th className="pb-3 font-medium text-slate-500">Status</th>
                    <th className="pb-3 font-medium text-slate-500">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <td className="py-3 font-medium text-slate-900">{lead.name}</td>
                      <td className="py-3 text-slate-600">{lead.address}</td>
                      <td className="py-3 text-slate-600">{formatSqft(lead.sqft)}</td>
                      <td className="py-3 text-slate-600">
                        {formatCurrency(lead.estimate_min)} - {formatCurrency(lead.estimate_max)}
                      </td>
                      <td className="py-3">
                        <Badge variant={getStatusBadgeVariant(lead.status)}>
                          {LEAD_STATUS_CONFIG[lead.status].label}
                        </Badge>
                      </td>
                      <td className="py-3 text-slate-500">{formatDate(lead.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 lg:hidden">
              {filtered.map((lead) => (
                <Card key={lead.id} onClick={() => navigate(`/leads/${lead.id}`)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{lead.name}</p>
                      <p className="text-sm text-slate-500 truncate">{lead.address}</p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(lead.status)}>
                      {LEAD_STATUS_CONFIG[lead.status].label}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                    <span>{formatSqft(lead.sqft)}</span>
                    <span>
                      {formatCurrency(lead.estimate_min)} - {formatCurrency(lead.estimate_max)}
                    </span>
                    <span>{formatDate(lead.created_at)}</span>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <LeadForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
        loading={creating}
      />
    </div>
  );
}
