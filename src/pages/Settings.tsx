import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { TeamMember } from '@/lib/types';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

const ROLES = ['sales', 'admin', 'installer'] as const;

const PRICING_KEY = 'reliable_turf_default_pricing';

interface PricingDefaults {
  min: string;
  max: string;
}

function getPricingDefaults(): PricingDefaults {
  try {
    const stored = localStorage.getItem(PRICING_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { min: '10', max: '12.25' };
}

interface TeamMemberForm {
  name: string;
  email: string;
  phone: string;
  role: string;
}

const emptyForm: TeamMemberForm = { name: '', email: '', phone: '', role: 'sales' };

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
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TeamMemberForm>(emptyForm);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [pricing, setPricing] = useState<PricingDefaults>(getPricingDefaults);
  const [pricingSaved, setPricingSaved] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    setLoading(true);
    const { data } = await supabase
      .from('team_members')
      .select('*')
      .order('created_at', { ascending: true });
    setMembers(data ?? []);
    setLoading(false);
  }

  function openAddModal() {
    setForm(emptyForm);
    setEditingId(null);
    setModalOpen(true);
  }

  function openEditModal(member: TeamMember) {
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone ?? '',
      role: member.role,
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
        })
        .eq('id', editingId);
    } else {
      await supabase.from('team_members').insert({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        role: form.role,
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

  function savePricing() {
    localStorage.setItem(PRICING_KEY, JSON.stringify(pricing));
    setPricingSaved(true);
    setTimeout(() => setPricingSaved(false), 2000);
  }

  const deleteMember = members.find((m) => m.id === deleteId);

  return (
    <div>
      <div className="flex items-center gap-3">
        <SettingsIcon size={24} className="text-slate-400" />
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
      </div>

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

      <section className="mt-8">
        <Card>
          <h2 className="text-lg font-semibold text-slate-900">Default Pricing</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Price per sq ft (min)"
              type="number"
              step="0.01"
              min="0"
              value={pricing.min}
              onChange={(e) => setPricing((p) => ({ ...p, min: e.target.value }))}
              placeholder="10.00"
            />
            <Input
              label="Price per sq ft (max)"
              type="number"
              step="0.01"
              min="0"
              value={pricing.max}
              onChange={(e) => setPricing((p) => ({ ...p, max: e.target.value }))}
              placeholder="12.25"
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button size="sm" onClick={savePricing}>
              Save Defaults
            </Button>
            {pricingSaved && (
              <span className="text-sm text-emerald-600">Saved</span>
            )}
          </div>
        </Card>
      </section>

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
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                Configured
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-slate-700">Resend (Email)</p>
                <p className="text-xs text-slate-500">Outbound email notifications</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                Configured
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
            placeholder="john@reliableturf.com"
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
    </div>
  );
}
