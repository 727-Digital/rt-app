import { useCallback, useEffect, useState } from 'react';
import { Phone, Plus, Star, UserCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { Organization, TeamMember } from '@/lib/types';

// ---------------------------------------------------------------------------
// Phone Numbers settings card.
//
// Two modes, switched on the caller's role:
//   • Sales / org admin: lists Signal House numbers owned by their org
//     only (current behavior).
//   • Platform admin: lists numbers from every org in one view, with an
//     "Org" tag on each row. Add/Edit forms include an org picker.
//
// The platform-admin path means Ty can manage white-label org numbers
// (Pro Green South, Gulf Breeze, etc.) without having to switch context.
// ---------------------------------------------------------------------------

interface SignalHouseNumber {
  id: string;
  org_id: string;
  phone_number: string;     // digits only e.g. '16784340360'
  display_number: string;   // '(678) 434-0360'
  team_member_id: string | null;
  is_default_for_org: boolean;
  status: 'active' | 'released';
  created_at: string;
}

function digitsOnly(s: string): string {
  return (s || '').replace(/\D/g, '');
}

function prettyPhone(raw: string): string {
  const d = digitsOnly(raw);
  const local = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (local.length !== 10) return raw;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

function normalizeE164Digits(raw: string): string | null {
  const d = digitsOnly(raw);
  if (d.length === 10) return '1' + d;
  if (d.length === 11 && d.startsWith('1')) return d;
  return null;
}

interface PhoneNumbersCardProps {
  orgId: string;
  canEdit: boolean;
}

export function PhoneNumbersCard({ orgId, canEdit }: PhoneNumbersCardProps) {
  const { isPlatformAdmin } = useAuth();
  const [numbers, setNumbers] = useState<SignalHouseNumber[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [reassignId, setReassignId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    if (isPlatformAdmin) {
      // Cross-org view: fetch every number, every team_member, every
      // org. Org tag on each row makes ownership obvious.
      const [n, m, o] = await Promise.all([
        supabase
          .from('signal_house_numbers')
          .select('*')
          .order('created_at', { ascending: true }),
        supabase
          .from('team_members')
          .select('*')
          .order('name', { ascending: true }),
        supabase
          .from('organizations')
          .select('*')
          .order('name', { ascending: true }),
      ]);
      setNumbers((n.data as SignalHouseNumber[]) ?? []);
      setMembers((m.data as TeamMember[]) ?? []);
      setOrgs((o.data as Organization[]) ?? []);
    } else {
      // Org-scoped view for sales/installer/org-admin.
      const [n, m] = await Promise.all([
        supabase
          .from('signal_house_numbers')
          .select('*')
          .eq('org_id', orgId)
          .order('is_default_for_org', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('team_members')
          .select('*')
          .eq('org_id', orgId)
          .order('name', { ascending: true }),
      ]);
      setNumbers((n.data as SignalHouseNumber[]) ?? []);
      setMembers((m.data as TeamMember[]) ?? []);
      setOrgs([]);
    }
    setLoading(false);
  }, [orgId, isPlatformAdmin]);

  useEffect(() => {
    if (orgId || isPlatformAdmin) load();
  }, [orgId, isPlatformAdmin, load]);

  function memberName(id: string | null): string {
    if (!id) return 'Available (no rep)';
    return members.find((m) => m.id === id)?.name ?? 'Unknown rep';
  }

  function orgInfo(id: string): { name: string; color: string } {
    const o = orgs.find((x) => x.id === id);
    return {
      name: o?.name ?? 'Unknown org',
      color: o?.primary_color ?? '#16a34a',
    };
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Phone numbers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Signal House numbers used to text customers. Assign one per rep so
            customers see a consistent caller ID.
            {isPlatformAdmin && (
              <span className="ml-1 text-emerald-700">
                Showing every org you manage.
              </span>
            )}
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 sm:w-auto"
          >
            <Plus size={16} />
            Add number
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {loading && (
          <p className="text-sm text-slate-400">Loading numbers…</p>
        )}
        {!loading && numbers.length === 0 && (
          <p className="text-sm text-slate-500">
            No numbers yet. Add the one you've been using and assign it to a rep.
          </p>
        )}
        {numbers.map((n) => {
          const org = isPlatformAdmin ? orgInfo(n.org_id) : null;
          return (
            <div
              key={n.id}
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3"
            >
              <Phone size={20} className="mt-0.5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-slate-900">
                    {n.display_number}
                  </p>
                  {org && (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{
                        backgroundColor: `${org.color}15`,
                        color: org.color,
                      }}
                    >
                      {org.name}
                    </span>
                  )}
                  {n.is_default_for_org && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      <Star size={10} />
                      Org default
                    </span>
                  )}
                  {n.status === 'released' && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                      Released
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {memberName(n.team_member_id)}
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setReassignId(n.id)}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100"
                >
                  Edit
                </button>
              )}
            </div>
          );
        })}
      </div>

      {addOpen && (
        <AddNumberModal
          defaultOrgId={orgId}
          orgs={orgs}
          members={members}
          isPlatformAdmin={isPlatformAdmin}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            load();
          }}
        />
      )}
      {reassignId && (
        <ReassignNumberModal
          number={numbers.find((n) => n.id === reassignId)!}
          members={members}
          onClose={() => setReassignId(null)}
          onSaved={() => {
            setReassignId(null);
            load();
          }}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------

interface AddNumberModalProps {
  defaultOrgId: string;
  orgs: Organization[];
  members: TeamMember[];
  isPlatformAdmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function AddNumberModal({
  defaultOrgId,
  orgs,
  members,
  isPlatformAdmin,
  onClose,
  onSaved,
}: AddNumberModalProps) {
  const [phone, setPhone] = useState('');
  const [orgId, setOrgId] = useState<string>(defaultOrgId);
  const [teamMemberId, setTeamMemberId] = useState<string>('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter assignee options to the picked org so we never produce a
  // cross-org assignment that orphans the team_member relationship.
  const eligibleMembers = members.filter((m) => m.org_id === orgId);

  async function handleSave() {
    setError(null);
    const normalized = normalizeE164Digits(phone);
    if (!normalized) {
      setError('Enter a 10-digit US phone number.');
      return;
    }
    if (!orgId) {
      setError('Pick an organization.');
      return;
    }
    setSaving(true);
    try {
      if (isDefault) {
        await supabase
          .from('signal_house_numbers')
          .update({ is_default_for_org: false })
          .eq('org_id', orgId)
          .eq('is_default_for_org', true);
      }
      const { error } = await supabase.from('signal_house_numbers').insert({
        org_id: orgId,
        phone_number: normalized,
        display_number: prettyPhone(normalized),
        team_member_id: teamMemberId || null,
        is_default_for_org: isDefault,
        status: 'active',
      });
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Add phone number">
      <div className="flex flex-col gap-4">
        <Input
          label="Phone number"
          placeholder="(678) 434-0360"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        {isPlatformAdmin && orgs.length > 1 && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              Organization
            </label>
            <select
              value={orgId}
              onChange={(e) => {
                setOrgId(e.target.value);
                setTeamMemberId(''); // reset assignee on org change
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select an org…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Assign to</label>
          <select
            value={teamMemberId}
            onChange={(e) => setTeamMemberId(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">No one yet (org pool)</option>
            {eligibleMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            <span className="font-medium">Use as org default</span>
            <br />
            <span className="text-xs text-slate-500">
              Sends from this number when a lead has no rep yet (intake SMS,
              unassigned leads). One per org.
            </span>
          </span>
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button onClick={handleSave} loading={saving} disabled={!phone}>
          Save number
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------

interface ReassignModalProps {
  number: SignalHouseNumber;
  members: TeamMember[];
  onClose: () => void;
  onSaved: () => void;
}

function ReassignNumberModal({ number, members, onClose, onSaved }: ReassignModalProps) {
  const [teamMemberId, setTeamMemberId] = useState<string>(number.team_member_id ?? '');
  const [isDefault, setIsDefault] = useState(number.is_default_for_org);
  const [status, setStatus] = useState(number.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show team members that belong to this number's org. Prevents a
  // platform admin from accidentally assigning a Pro Green South line
  // to a Reliable Turf rep.
  const eligibleMembers = members.filter((m) => m.org_id === number.org_id);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      if (isDefault && !number.is_default_for_org) {
        await supabase
          .from('signal_house_numbers')
          .update({ is_default_for_org: false })
          .eq('org_id', number.org_id)
          .eq('is_default_for_org', true);
      }
      const { error } = await supabase
        .from('signal_house_numbers')
        .update({
          team_member_id: teamMemberId || null,
          is_default_for_org: isDefault,
          status,
        })
        .eq('id', number.id);
      if (error) {
        setError(error.message);
        setSaving(false);
        return;
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={`${number.display_number}`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Assigned to</label>
          <select
            value={teamMemberId}
            onChange={(e) => setTeamMemberId(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">No one (release to pool)</option>
            {eligibleMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            <span className="font-medium">Use as org default</span>
            <br />
            <span className="text-xs text-slate-500">
              One per org. Used when a lead has no rep yet.
            </span>
          </span>
        </label>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'active' | 'released')}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="active">Active</option>
            <option value="released">Released (won't send)</option>
          </select>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <Button onClick={handleSave} loading={saving}>
          <UserCheck size={14} />
          Save
        </Button>
        <button
          type="button"
          onClick={onClose}
          className="self-center text-xs text-slate-500 hover:underline"
        >
          <X size={10} className="mr-1 inline" />
          Cancel
        </button>
      </div>
    </Modal>
  );
}
