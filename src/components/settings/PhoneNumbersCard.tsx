import { useCallback, useEffect, useState } from 'react';
import { Phone, Plus, Star, UserCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import type { TeamMember } from '@/lib/types';

// ---------------------------------------------------------------------------
// Phone Numbers settings card.
// Lists Signal House numbers owned by the current org. Each number is
// optionally bound to a rep (their personal line) and at most one row is
// flagged is_default_for_org (the floating number used for unassigned
// leads and pre-claim customer intake).
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

// Format any 10- or 11-digit US phone as '(xxx) xxx-xxxx'. Drops leading 1.
function prettyPhone(raw: string): string {
  const d = digitsOnly(raw);
  const local = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  if (local.length !== 10) return raw;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

// Normalize input → 11-digit E.164-ish '1xxxxxxxxxx' for storage.
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
  const [numbers, setNumbers] = useState<SignalHouseNumber[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [reassignId, setReassignId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    if (orgId) load();
  }, [orgId, load]);

  function memberName(id: string | null): string {
    if (!id) return 'Available (no rep)';
    return members.find((m) => m.id === id)?.name ?? 'Unknown rep';
  }

  return (
    <Card>
      {/* Header stacks on mobile so the title isn't cramped against the
          action; same-row on tablet+. Add Number is a real-sized button
          on mobile (full width, 44px tall) so it's an obvious tap target. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Phone numbers</h2>
          <p className="mt-1 text-sm text-slate-500">
            Signal House numbers used to text customers. Assign one per rep so
            customers see a consistent caller ID.
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
        {numbers.map((n) => (
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
        ))}
      </div>

      {addOpen && (
        <AddNumberModal
          orgId={orgId}
          members={members}
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
  orgId: string;
  members: TeamMember[];
  onClose: () => void;
  onSaved: () => void;
}

function AddNumberModal({ orgId, members, onClose, onSaved }: AddNumberModalProps) {
  const [phone, setPhone] = useState('');
  const [teamMemberId, setTeamMemberId] = useState<string>('');
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    const normalized = normalizeE164Digits(phone);
    if (!normalized) {
      setError('Enter a 10-digit US phone number.');
      return;
    }
    setSaving(true);
    try {
      // If marking this as the new org default, first unset any previous one.
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
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700">Assign to</label>
          <select
            value={teamMemberId}
            onChange={(e) => setTeamMemberId(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">No one yet (org pool)</option>
            {members.map((m) => (
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
            {members.map((m) => (
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
