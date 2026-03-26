import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Mail, Phone, Plus, Search, Users } from 'lucide-react';
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
import { LEAD_STATUS_CONFIG, PIPELINE_STAGES, type Lead, type LeadStatus } from '@/lib/types';
import { formatCompactCurrency, formatDate, formatSqft, formatSqftCompact } from '@/lib/utils';

type SortField = 'name' | 'address' | 'sqft' | 'estimate_min' | 'status' | 'created_at';
type SortDir = 'asc' | 'desc';

type MobileSort = 'newest' | 'oldest' | 'name_az' | 'largest_area' | 'highest_estimate';

const MOBILE_SORT_OPTIONS: { value: MobileSort; label: string; field: SortField; dir: SortDir }[] = [
  { value: 'newest', label: 'Newest First', field: 'created_at', dir: 'desc' },
  { value: 'oldest', label: 'Oldest First', field: 'created_at', dir: 'asc' },
  { value: 'name_az', label: 'Name A-Z', field: 'name', dir: 'asc' },
  { value: 'largest_area', label: 'Largest Area', field: 'sqft', dir: 'desc' },
  { value: 'highest_estimate', label: 'Highest Estimate', field: 'estimate_min', dir: 'desc' },
];

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

function compareLead(a: Lead, b: Lead, field: SortField, dir: SortDir): number {
  let cmp = 0;
  switch (field) {
    case 'name':
    case 'address':
      cmp = a[field].localeCompare(b[field]);
      break;
    case 'sqft':
    case 'estimate_min':
      cmp = a[field] - b[field];
      break;
    case 'status':
      cmp = PIPELINE_STAGES.indexOf(a.status) - PIPELINE_STAGES.indexOf(b.status);
      break;
    case 'created_at':
      cmp = a.created_at.localeCompare(b.created_at);
      break;
  }
  return dir === 'asc' ? cmp : -cmp;
}

export default function Leads() {
  const { leads, loading, refetch } = useLeads();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [mobileSort, setMobileSort] = useState<MobileSort>('newest');

  function handleColumnSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' || field === 'address' ? 'asc' : 'desc');
    }
  }

  function handleMobileSortChange(value: string) {
    const opt = MOBILE_SORT_OPTIONS.find((o) => o.value === value);
    if (!opt) return;
    setMobileSort(opt.value);
    setSortField(opt.field);
    setSortDir(opt.dir);
  }

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

    return [...result].sort((a, b) => compareLead(a, b, sortField, sortDir));
  }, [leads, search, statusFilter, sortField, sortDir]);

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

  const SortIcon = sortDir === 'asc' ? ChevronUp : ChevronDown;

  function renderTh(label: string, field: SortField) {
    const active = sortField === field;
    return (
      <th
        className="pb-3 font-medium text-slate-500 cursor-pointer select-none hover:text-slate-700"
        onClick={() => handleColumnSort(field)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active && <SortIcon size={14} className="text-slate-700" />}
        </span>
      </th>
    );
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
        <div className="w-full sm:w-48 lg:hidden">
          <Select
            value={mobileSort}
            onChange={(e) => handleMobileSortChange(e.target.value)}
          >
            {MOBILE_SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
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
                    {renderTh('Name', 'name')}
                    {renderTh('Address', 'address')}
                    {renderTh('Sqft', 'sqft')}
                    {renderTh('Estimate', 'estimate_min')}
                    {renderTh('Status', 'status')}
                    {renderTh('Created', 'created_at')}
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
                      <td className="py-3 text-slate-600">{formatSqftCompact(lead.sqft)}</td>
                      <td className="py-3 text-slate-600 whitespace-nowrap">
                        {formatCompactCurrency(lead.estimate_min)} – {formatCompactCurrency(lead.estimate_max)}
                      </td>
                      <td className="py-3">
                        <Badge variant={getStatusBadgeVariant(lead.status)}>
                          {LEAD_STATUS_CONFIG[lead.status].label}
                        </Badge>
                      </td>
                      <td className="py-3 text-slate-500 whitespace-nowrap">{formatDate(lead.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 lg:hidden">
              {filtered.map((lead) => (
                <Card key={lead.id}>
                  <div
                    className="flex items-start justify-between gap-2"
                    onClick={() => navigate(`/leads/${lead.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900 truncate">{lead.name}</p>
                      <p className="text-sm text-slate-500 truncate">{lead.address}</p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(lead.status)}>
                      {LEAD_STATUS_CONFIG[lead.status].label}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>{formatSqft(lead.sqft)}</span>
                      <span>{formatDate(lead.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${lead.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      >
                        <Phone size={14} />
                      </a>
                      <a
                        href={`sms:${lead.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100"
                      >
                        <Mail size={14} />
                      </a>
                    </div>
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
