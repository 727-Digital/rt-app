import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Settings as SettingsIcon, Save } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { TeamMember, Territory, Organization } from '@/lib/types';
import { fetchAllOrganizations } from '@/lib/queries/organizations';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { useOrg } from '@/hooks/useOrg';

const ROLES = ['sales', 'admin', 'installer'] as const;

const PAYMENT_METHOD_OPTIONS = ['check', 'zelle', 'financing'] as const;

interface TeamMemberForm {
  name: string;
  email: string;
  phone: string;
  role: string;
  org_id: string;
}

const emptyForm: TeamMemberForm = { name: '', email: '', phone: '', role: 'sales', org_id: '' };

interface OrgForm {
  name: string;
  logo_url: string;
  primary_color: string;
  phone: string;
  email: string;
  google_review_url: string;
  pricing_min: string;
  pricing_max: string;
  payment_methods: string[];
  warranty_text: string;
}

interface TerritoryForm {
  name: string;
  zip_codes: string;
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  label: string;
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-emerald-500 transition-colors" />
        <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </div>
      <span className="text-sm text-slate-600">{label}</span>
    </label>
  );
}

export default function Settings() {
  const { orgId, role, isPlatformAdmin } = useAuth();
  const { org, refetch: refetchOrg, updateOrganization } = useOrg();

  const canEditOrg = isPlatformAdmin || role === 'org_admin';

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TeamMemberForm>(emptyForm);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [allOrgs, setAllOrgs] = useState<Organization[]>([]);

  const [orgForm, setOrgForm] = useState<OrgForm>({
    name: '',
    logo_url: '',
    primary_color: '#059669',
    phone: '',
    email: '',
    google_review_url: '',
    pricing_min: '10',
    pricing_max: '12.25',
    payment_methods: ['check', 'zelle'],
    warranty_text: '',
  });
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);

  const [territories, setTerritories] = useState<Territory[]>([]);
  const [territoriesLoading, setTerritoriesLoading] = useState(false);
  const [territoryForm, setTerritoryForm] = useState<TerritoryForm>({ name: '', zip_codes: '' });
  const [editingTerritoryId, setEditingTerritoryId] = useState<string | null>(null);
  const [territoryModalOpen, setTerritoryModalOpen] = useState(false);
  const [territorySaving, setTerritorySaving] = useState(false);

  useEffect(() => {
    fetchMembers();
    loadAllOrgs();
  }, []);

  async function loadAllOrgs() {
    try {
      const orgs = await fetchAllOrganizations();
      setAllOrgs(orgs);
    } catch {
      // handle silently
    }
  }

  useEffect(() => {
    if (org) {
      setOrgForm({
        name: org.name || '',
        logo_url: org.logo_url || '',
        primary_color: org.primary_color || '#059669',
        phone: org.phone || '',
        email: org.email || '',
        google_review_url: org.google_review_url || '',
        pricing_min: String(org.pricing_min ?? 10),
        pricing_max: String(org.pricing_max ?? 12.25),
        payment_methods: org.payment_methods ?? ['check', 'zelle'],
        warranty_text: org.warranty_text || '',
      });
    }
  }, [org]);

  useEffect(() => {
    if (isPlatformAdmin || canEditOrg) {
      fetchTerritories();
    }
  }, [isPlatformAdmin, canEditOrg, orgId]);

  async function fetchMembers() {
    setLoading(true);
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: true });
    setMembers(data ?? []);
    setLoading(false);
  }

  async function fetchTerritories() {
    setTerritoriesLoading(true);
    const query = supabase.from('territories').select('*').order('name');
    if (!isPlatformAdmin && orgId) {
      query.eq('org_id', orgId);
    }
    const { data } = await query;
    setTerritories((data ?? []) as Territory[]);
    setTerritoriesLoading(false);
  }

  function openAddModal() {
    setForm({ ...emptyForm, org_id: orgId || '' });
    setEditingId(null);
    setModalOpen(true);
  }

  function openEditModal(member: TeamMember) {
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone ?? '',
      role: member.role,
      org_id: member.org_id || '',
    });
    setEditingId(member.id);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.email.trim()) return;
    setSaving(true);

    if (editingId) {
      await supabase
        .from('team_members')
        .update({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          role: form.role,
          org_id: form.org_id || orgId,
        })
        .eq('id', editingId);
    } else {
      await supabase.from('team_members').insert({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        role: form.role,
        org_id: form.org_id || orgId,
      });
    }

    setSaving(false);
    setModalOpen(false);
    fetchMembers();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from('team_members').delete().eq('id', deleteId);
    setDeleteId(null);
    fetchMembers();
  }

  async function handleToggle(id: string, field: 'notify_sms' | 'notify_email', value: boolean) {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
    await supabase.from('team_members').update({ [field]: value }).eq('id', id);
  }

  async function handleOrgSave() {
    setOrgSaving(true);
    try {
      await updateOrganization({
        name: orgForm.name.trim(),
        logo_url: orgForm.logo_url.trim() || null,
        primary_color: orgForm.primary_color,
        phone: orgForm.phone.trim() || null,
        email: orgForm.email.trim() || null,
        google_review_url: orgForm.google_review_url.trim() || null,
        pricing_min: parseFloat(orgForm.pricing_min) || 10,
        pricing_max: parseFloat(orgForm.pricing_max) || 12.25,
        payment_methods: orgForm.payment_methods,
        warranty_text: orgForm.warranty_text.trim() || null,
      });
      await refetchOrg();
      setOrgSaved(true);
      setTimeout(() => setOrgSaved(false), 2000);
    } finally {
      setOrgSaving(false);
    }
  }

  function togglePaymentMethod(method: string) {
    setOrgForm((prev) => {
      const methods = prev.payment_methods.includes(method)
        ? prev.payment_methods.filter((m) => m !== method)
        : [...prev.payment_methods, method];
      return { ...prev, payment_methods: methods };
    });
  }

  async function handleTerritorySave() {
    if (!territoryForm.name.trim()) return;
    setTerritorySaving(true);
    const zipCodes = territoryForm.zip_codes
      .split(',')
      .map((z) => z.trim())
      .filter(Boolean);

    if (editingTerritoryId) {
      await supabase
        .from('territories')
        .update({ name: territoryForm.name.trim(), zip_codes: zipCodes })
        .eq('id', editingTerritoryId);
    } else {
      await supabase.from('territories').insert({
        org_id: orgId,
        name: territoryForm.name.trim(),
        zip_codes: zipCodes,
        is_active: true,
      });
    }
    setTerritorySaving(false);
    setTerritoryModalOpen(false);
    setEditingTerritoryId(null);
    setTerritoryForm({ name: '', zip_codes: '' });
    fetchTerritories();
  }

  async function handleTerritoryToggle(id: string, isActive: boolean) {
    setTerritories((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_active: isActive } : t)),
    );
    await supabase.from('territories').update({ is_active: isActive }).eq('id', id);
  }

  function openEditTerritory(t: Territory) {
    setTerritoryForm({ name: t.name, zip_codes: t.zip_codes.join(', ') });
    setEditingTerritoryId(t.id);
    setTerritoryModalOpen(true);
  }

  function openAddTerritory() {
    setTerritoryForm({ name: '', zip_codes: '' });
    setEditingTerritoryId(null);
    setTerritoryModalOpen(true);
  }

  const deleteMember = members.find((m) => m.id === deleteId);

  return (
    <div>
      <div className="flex items-center gap-3">
        <SettingsIcon size={24} className="text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      </div>

      {canEditOrg && org && (
        <section className="mt-8">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900">Organization</h2>
            <div className="mt-4 flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Company Name"
                  value={orgForm.name}
                  onChange={(e) => setOrgForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Reliable Turf"
                />
                <Input
                  label="Logo URL"
                  value={orgForm.logo_url}
                  onChange={(e) => setOrgForm((f) => ({ ...f, logo_url: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={orgForm.primary_color}
                      onChange={(e) => setOrgForm((f) => ({ ...f, primary_color: e.target.value }))}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200"
                    />
                    <Input
                      value={orgForm.primary_color}
                      onChange={(e) => setOrgForm((f) => ({ ...f, primary_color: e.target.value }))}
                      placeholder="#059669"
                      className="flex-1"
                    />
                  </div>
                </div>
                <Input
                  label="Phone"
                  type="tel"
                  value={orgForm.phone}
                  onChange={(e) => setOrgForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(850) 565-7099"
                />
                <Input
                  label="Email"
                  type="email"
                  value={orgForm.email}
                  onChange={(e) => setOrgForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="info@reliableturf.com"
                />
              </div>
              <Input
                label="Google Review URL"
                value={orgForm.google_review_url}
                onChange={(e) => setOrgForm((f) => ({ ...f, google_review_url: e.target.value }))}
                placeholder="https://g.page/r/your-business/review"
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="Default Price per sq ft (min)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={orgForm.pricing_min}
                  onChange={(e) => setOrgForm((f) => ({ ...f, pricing_min: e.target.value }))}
                  placeholder="10.00"
                />
                <Input
                  label="Default Price per sq ft (max)"
                  type="number"
                  step="0.01"
                  min="0"
                  value={orgForm.pricing_max}
                  onChange={(e) => setOrgForm((f) => ({ ...f, pricing_max: e.target.value }))}
                  placeholder="12.25"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">Payment Methods</label>
                <div className="flex items-center gap-4">
                  {PAYMENT_METHOD_OPTIONS.map((method) => (
                    <label key={method} className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={orgForm.payment_methods.includes(method)}
                        onChange={() => togglePaymentMethod(method)}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-sm text-slate-700 capitalize">{method}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Textarea
                label="Default Warranty Text"
                value={orgForm.warranty_text}
                onChange={(e) => setOrgForm((f) => ({ ...f, warranty_text: e.target.value }))}
                placeholder="1 year workmanship warranty..."
                className="min-h-[60px]"
              />
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={handleOrgSave} loading={orgSaving}>
                  <Save size={14} />
                  Save Organization
                </Button>
                {orgSaved && (
                  <span className="text-sm text-emerald-600">Saved</span>
                )}
              </div>
            </div>
          </Card>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Team Members</h2>
          <Button size="sm" onClick={openAddModal}>
            <Plus size={16} />
            Add Team Member
          </Button>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-slate-500">Loading team members...</div>
        ) : members.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-slate-500">No team members yet. Add your first team member to get started.</p>
          </Card>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {members.map((member) => (
              <Card key={member.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{member.name}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 capitalize">
                      {member.role}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5 text-sm text-slate-500">
                    <span>{member.email}</span>
                    {member.phone && <span>{member.phone}</span>}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="flex items-center gap-4">
                    <Toggle
                      checked={member.notify_email}
                      onChange={(val) => handleToggle(member.id, 'notify_email', val)}
                      label="Email"
                    />
                    <Toggle
                      checked={member.notify_sms}
                      onChange={(val) => handleToggle(member.id, 'notify_sms', val)}
                      label="SMS"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditModal(member)}>
                      <Pencil size={14} />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(member.id)}>
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {isPlatformAdmin && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Territories</h2>
            <Button size="sm" onClick={openAddTerritory}>
              <Plus size={16} />
              Add Territory
            </Button>
          </div>

          {territoriesLoading ? (
            <div className="mt-4 text-sm text-slate-500">Loading territories...</div>
          ) : territories.length === 0 ? (
            <Card className="mt-4">
              <p className="text-sm text-slate-500">No territories configured.</p>
            </Card>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {territories.map((t) => (
                <Card key={t.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{t.name}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                        {t.zip_codes.length} zip codes
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400 truncate">
                      {t.zip_codes.slice(0, 10).join(', ')}
                      {t.zip_codes.length > 10 ? '...' : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Toggle
                      checked={t.is_active}
                      onChange={(val) => handleTerritoryToggle(t.id, val)}
                      label="Active"
                    />
                    <Button variant="ghost" size="sm" onClick={() => openEditTerritory(t)}>
                      <Pencil size={14} />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-8">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
          <p className="mt-2 text-sm text-slate-500">
            Notifications are sent via Twilio (SMS) and Resend (email) when new leads arrive, quotes are viewed, and quotes are approved.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Twilio (SMS)</p>
                <p className="text-xs text-slate-500">Outbound SMS notifications</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Not Configured
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Resend (Email)</p>
                <p className="text-xs text-slate-500">Outbound email notifications</p>
              </div>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                Not Configured
              </span>
            </div>
          </div>
        </Card>
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Team Member' : 'Add Team Member'}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="John Smith"
          />
          <Input
            label="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="john@example.com"
          />
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="(850) 555-1234"
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <Select
            label="Organization"
            value={form.org_id}
            onChange={(e) => setForm((f) => ({ ...f, org_id: e.target.value }))}
          >
            <option value="">Select organization...</option>
            {allOrgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </Select>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={!form.name.trim() || !form.email.trim()}>
              {editingId ? 'Save Changes' : 'Add Member'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Team Member"
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to remove <span className="font-medium">{deleteMember?.name}</span> from the team? This action cannot be undone.
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

      <Modal
        open={territoryModalOpen}
        onClose={() => setTerritoryModalOpen(false)}
        title={editingTerritoryId ? 'Edit Territory' : 'Add Territory'}
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Territory Name"
            required
            value={territoryForm.name}
            onChange={(e) => setTerritoryForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Gulf Breeze"
          />
          <Textarea
            label="Zip Codes (comma-separated)"
            value={territoryForm.zip_codes}
            onChange={(e) => setTerritoryForm((f) => ({ ...f, zip_codes: e.target.value }))}
            placeholder="32561, 32563, 32566"
            className="min-h-[60px]"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setTerritoryModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleTerritorySave}
              loading={territorySaving}
              disabled={!territoryForm.name.trim()}
            >
              {editingTerritoryId ? 'Save Changes' : 'Add Territory'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
