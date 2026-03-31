import { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Phone,
  Mail,
  Users,
  MapPin,
  Trash2,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhone } from '@/lib/utils';
import type { Organization } from '@/lib/types';
import {
  fetchAllOrganizations,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '@/lib/queries/organizations';
import { fetchTerritories } from '@/lib/queries/territories';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { TerritoryManager } from '@/components/settings/TerritoryManager';
import BrandAssets from '@/components/organizations/BrandAssets';

type Tab = 'companies' | 'territories' | 'brand-assets';

const PAYMENT_METHOD_OPTIONS = ['check', 'zelle', 'financing'] as const;

const DEFAULT_WARRANTY =
  'All installations include a 1-year workmanship warranty covering seams, edges, and drainage. Turf manufacturer warranty applies separately.';

interface OrgFormState {
  name: string;
  slug: string;
  phone: string;
  email: string;
  address: string;
  logo_url: string;
  primary_color: string;
  pricing_min: string;
  pricing_max: string;
  payment_methods: string[];
  warranty_text: string;
  google_review_url: string;
}

const emptyOrgForm: OrgFormState = {
  name: '',
  slug: '',
  phone: '',
  email: '',
  address: '',
  logo_url: '',
  primary_color: '#16a34a',
  pricing_min: '',
  pricing_max: '',
  payment_methods: ['check', 'zelle'],
  warranty_text: DEFAULT_WARRANTY,
  google_review_url: '',
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

interface OrgStats {
  territories: number;
  members: number;
}

export default function Organizations() {
  const [tab, setTab] = useState<Tab>('companies');
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgStats, setOrgStats] = useState<Record<string, OrgStats>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OrgFormState>(emptyOrgForm);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadOrgs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllOrganizations();
      setOrgs(data);

      const stats: Record<string, OrgStats> = {};
      await Promise.all(
        data.map(async (org) => {
          const [terrs, members] = await Promise.all([
            fetchTerritories(org.id),
            supabase
              .from('team_members')
              .select('id', { count: 'exact', head: true })
              .eq('org_id', org.id),
          ]);
          stats[org.id] = {
            territories: terrs.length,
            members: members.count ?? 0,
          };
        }),
      );
      setOrgStats(stats);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  function openAdd() {
    setForm(emptyOrgForm);
    setEditingId(null);
    setModalOpen(true);
  }

  function openEdit(org: Organization) {
    setForm({
      name: org.name,
      slug: org.slug,
      phone: org.phone ?? '',
      email: org.email ?? '',
      address: org.address ?? '',
      logo_url: org.logo_url ?? '',
      primary_color: org.primary_color ?? '#16a34a',
      pricing_min: org.pricing_min != null ? String(org.pricing_min) : '',
      pricing_max: org.pricing_max != null ? String(org.pricing_max) : '',
      payment_methods: org.payment_methods ?? ['check', 'zelle'],
      warranty_text: org.warranty_text ?? '',
      google_review_url: org.google_review_url ?? '',
    });
    setEditingId(org.id);
    setModalOpen(true);
  }

  function handleNameChange(name: string) {
    setForm((f) => ({
      ...f,
      name,
      slug: !editingId || f.slug === slugify(f.name) ? slugify(name) : f.slug,
    }));
  }

  function togglePaymentMethod(method: string) {
    setForm((f) => {
      const methods = f.payment_methods.includes(method)
        ? f.payment_methods.filter((m) => m !== method)
        : [...f.payment_methods, method];
      return { ...f, payment_methods: methods };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      logo_url: form.logo_url.trim() || null,
      primary_color: form.primary_color || '#16a34a',
      pricing_min: form.pricing_min ? parseFloat(form.pricing_min) : 0,
      pricing_max: form.pricing_max ? parseFloat(form.pricing_max) : 0,
      payment_methods: form.payment_methods,
      warranty_text: form.warranty_text.trim() || null,
      google_review_url: form.google_review_url.trim() || null,
    };

    try {
      if (editingId) {
        await updateOrganization(editingId, payload);
      } else {
        await createOrganization(payload as Omit<Organization, 'id' | 'created_at' | 'updated_at'>);
      }
      setModalOpen(false);
      await loadOrgs();
    } catch {
      // handle silently
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteOrganization(deleteId);
      setDeleteId(null);
      await loadOrgs();
    } catch {
      // handle silently
    }
  }

  const deleteTarget = orgs.find((o) => o.id === deleteId);

  return (
    <div>
      <div className="flex items-center gap-3">
        <Building2 size={24} className="text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
      </div>

      <div className="mt-6 flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          onClick={() => setTab('companies')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            tab === 'companies'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900',
          )}
        >
          Companies
        </button>
        <button
          onClick={() => setTab('territories')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            tab === 'territories'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900',
          )}
        >
          Territories
        </button>
        <button
          onClick={() => setTab('brand-assets')}
          className={cn(
            'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors',
            tab === 'brand-assets'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900',
          )}
        >
          Brand Assets
        </button>
      </div>

      {tab === 'companies' && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">All Companies</h2>
            <Button size="sm" onClick={openAdd}>
              <Plus size={16} />
              Add Organization
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size={24} />
            </div>
          ) : orgs.length === 0 ? (
            <Card>
              <p className="text-sm text-slate-500">No organizations yet. Create your first one to get started.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {orgs.map((org) => (
                <Card
                  key={org.id}
                  className="flex flex-col gap-3"
                  onClick={() => openEdit(org)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                        style={{ backgroundColor: org.primary_color || '#16a34a' }}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{org.name}</h3>
                        <p className="text-xs text-slate-400">{org.slug}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(org.id);
                        }}
                      >
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 text-sm text-slate-500">
                    {org.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} />
                        <span>{formatPhone(org.phone)}</span>
                      </div>
                    )}
                    {org.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={14} />
                        <span>{org.email}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="blue">
                      <span className="flex items-center gap-1">
                        <MapPin size={12} />
                        {orgStats[org.id]?.territories ?? 0} territories
                      </span>
                    </Badge>
                    <Badge variant="slate">
                      <span className="flex items-center gap-1">
                        <Users size={12} />
                        {orgStats[org.id]?.members ?? 0} members
                      </span>
                    </Badge>
                    <div
                      className="h-5 w-5 rounded-full border border-slate-200"
                      style={{ backgroundColor: org.primary_color || '#16a34a' }}
                      title={org.primary_color || '#16a34a'}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'territories' && (
        <div className="mt-6">
          <TerritoryManager />
        </div>
      )}

      {tab === 'brand-assets' && (
        <div className="mt-6">
          <BrandAssets />
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Organization' : 'Add Organization'}
        className="max-w-2xl"
      >
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Company Info</h3>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Name"
                  required
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Reliable Turf Atlanta"
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Slug</label>
                  <div className="flex items-center gap-0">
                    <span className="h-10 flex items-center rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-400 whitespace-nowrap">
                      /q/
                    </span>
                    <input
                      value={form.slug}
                      onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                      placeholder="reliable-turf-atlanta"
                      className="h-10 w-full rounded-r-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(850) 565-7099"
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="info@reliableturf.com"
                />
              </div>
              <Textarea
                label="Address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="123 Main St, Atlanta, GA 30301"
                className="min-h-[60px]"
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Branding</h3>
            <div className="flex flex-col gap-4">
              <Input
                label="Logo URL"
                value={form.logo_url}
                onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
                placeholder="https://example.com/logo.png"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200"
                  />
                  <Input
                    value={form.primary_color}
                    onChange={(e) => setForm((f) => ({ ...f, primary_color: e.target.value }))}
                    placeholder="#16a34a"
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Pricing</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Min Price per sqft"
                type="number"
                step="0.25"
                min="0"
                value={form.pricing_min}
                onChange={(e) => setForm((f) => ({ ...f, pricing_min: e.target.value }))}
                placeholder="10.00"
              />
              <Input
                label="Max Price per sqft"
                type="number"
                step="0.25"
                min="0"
                value={form.pricing_max}
                onChange={(e) => setForm((f) => ({ ...f, pricing_max: e.target.value }))}
                placeholder="12.25"
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Payment & Warranty</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Payment Methods</label>
                <div className="flex items-center gap-4">
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <label key={method} className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.payment_methods.includes(method)}
                        onChange={() => togglePaymentMethod(method)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-700 capitalize">{method}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Textarea
                label="Warranty Text"
                value={form.warranty_text}
                onChange={(e) => setForm((f) => ({ ...f, warranty_text: e.target.value }))}
                placeholder="1 year workmanship warranty..."
                className="min-h-[60px]"
              />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Review</h3>
            <Input
              label="Google Review URL"
              value={form.google_review_url}
              onChange={(e) => setForm((f) => ({ ...f, google_review_url: e.target.value }))}
              placeholder="https://g.page/r/your-business/review"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!form.name.trim()}
            >
              <Save size={14} />
              {editingId ? 'Save Changes' : 'Create Organization'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Organization"
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete{' '}
          <span className="font-medium">{deleteTarget?.name}</span>? This will also remove all associated territories, team members, and leads. This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
