import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Organization } from '@/lib/types';
import {
  fetchTerritories,
  createTerritory,
  updateTerritory,
  deleteTerritory,
  type TerritoryWithOrg,
} from '@/lib/queries/territories';
import { fetchAllOrganizations } from '@/lib/queries/organizations';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';

interface TerritoryManagerProps {
  orgId?: string;
}

interface TerritoryFormState {
  name: string;
  org_id: string;
  zip_codes: string[];
  is_active: boolean;
}

const emptyForm: TerritoryFormState = {
  name: '',
  org_id: '',
  zip_codes: [],
  is_active: true,
};

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

function TerritoryManager({ orgId }: TerritoryManagerProps) {
  const [territories, setTerritories] = useState<TerritoryWithOrg[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TerritoryFormState>(emptyForm);
  const [zipInput, setZipInput] = useState('');
  const [zipError, setZipError] = useState('');

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [terrs, orgs] = await Promise.all([
        fetchTerritories(orgId),
        fetchAllOrganizations(),
      ]);
      setTerritories(terrs);
      setOrganizations(orgs);
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openAdd() {
    setForm({ ...emptyForm, org_id: orgId || '' });
    setEditingId(null);
    setZipInput('');
    setZipError('');
    setModalOpen(true);
  }

  function openEdit(t: TerritoryWithOrg) {
    setForm({
      name: t.name,
      org_id: t.org_id,
      zip_codes: [...t.zip_codes],
      is_active: t.is_active,
    });
    setEditingId(t.id);
    setZipInput('');
    setZipError('');
    setModalOpen(true);
  }

  function parseAndAddZips(raw: string) {
    const parsed = raw
      .split(/[\s,\n]+/)
      .map((z) => z.trim())
      .filter(Boolean);

    const valid: string[] = [];
    const invalid: string[] = [];

    for (const z of parsed) {
      if (/^\d{5}$/.test(z)) {
        if (!form.zip_codes.includes(z) && !valid.includes(z)) {
          valid.push(z);
        }
      } else {
        invalid.push(z);
      }
    }

    if (valid.length > 0) {
      setForm((f) => ({ ...f, zip_codes: [...f.zip_codes, ...valid] }));
    }

    if (invalid.length > 0) {
      setZipError(`Invalid: ${invalid.join(', ')} (must be 5 digits)`);
    } else {
      setZipError('');
    }

    setZipInput('');
  }

  function handleZipKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (zipInput.trim()) {
        parseAndAddZips(zipInput);
      }
    }
  }

  function removeZip(zip: string) {
    setForm((f) => ({ ...f, zip_codes: f.zip_codes.filter((z) => z !== zip) }));
  }

  function clearAllZips() {
    setForm((f) => ({ ...f, zip_codes: [] }));
  }

  async function handleSave() {
    if (!form.name.trim() || !form.org_id) return;
    setSaving(true);

    try {
      if (editingId) {
        await updateTerritory(editingId, {
          name: form.name.trim(),
          org_id: form.org_id,
          zip_codes: form.zip_codes,
          is_active: form.is_active,
        });
      } else {
        await createTerritory({
          name: form.name.trim(),
          org_id: form.org_id,
          zip_codes: form.zip_codes,
          is_active: form.is_active,
        });
      }
      setModalOpen(false);
      await loadData();
    } catch {
      // handle silently
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteTerritory(deleteId);
      setDeleteId(null);
      await loadData();
    } catch {
      // handle silently
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    setTerritories((prev) =>
      prev.map((t) => (t.id === id ? { ...t, is_active: isActive } : t)),
    );
    try {
      await updateTerritory(id, { is_active: isActive });
    } catch {
      // revert on failure
      await loadData();
    }
  }

  const deleteTarget = territories.find((t) => t.id === deleteId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin size={20} className="text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Territories</h2>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus size={16} />
          Add Territory
        </Button>
      </div>

      {territories.length === 0 ? (
        <Card className="mt-4">
          <p className="text-sm text-slate-500">No territories configured yet.</p>
        </Card>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {territories.map((t) => (
            <Card key={t.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-900">{t.name}</span>
                  {!orgId && t.organization && (
                    <Badge variant="blue">{t.organization.name}</Badge>
                  )}
                  <Badge variant="slate">{t.zip_codes.length} zip codes</Badge>
                  {!t.is_active && <Badge variant="amber">Inactive</Badge>}
                </div>
                <p className="mt-0.5 text-xs text-slate-400 truncate">
                  {t.zip_codes.slice(0, 10).join(', ')}
                  {t.zip_codes.length > 10 ? '...' : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Toggle
                  checked={t.is_active}
                  onChange={(val) => handleToggleActive(t.id, val)}
                  label="Active"
                />
                <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteId(t.id)}>
                  <Trash2 size={14} className="text-red-500" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Territory' : 'Add Territory'}
        className="max-w-xl"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Territory Name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Atlanta Metro"
          />

          <Select
            label="Organization"
            value={form.org_id}
            onChange={(e) => setForm((f) => ({ ...f, org_id: e.target.value }))}
            disabled={!!orgId}
          >
            <option value="">Select organization...</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </Select>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">Zip Codes</label>
            <div className="flex gap-2">
              <Input
                value={zipInput}
                onChange={(e) => {
                  setZipInput(e.target.value);
                  setZipError('');
                }}
                onKeyDown={handleZipKeyDown}
                placeholder="Type or paste zip codes..."
                className="flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (zipInput.trim()) parseAndAddZips(zipInput);
                }}
                className="shrink-0"
              >
                Add
              </Button>
            </div>
            {zipError && <p className="text-xs text-red-500">{zipError}</p>}
            <p className="text-xs text-slate-400">
              Paste multiple zips separated by commas, spaces, or newlines
            </p>

            {form.zip_codes.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-600">
                    {form.zip_codes.length} zip code{form.zip_codes.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={clearAllZips}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Clear All
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto rounded-lg border border-slate-200 p-2">
                  {form.zip_codes.map((zip) => (
                    <span
                      key={zip}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700',
                      )}
                    >
                      {zip}
                      <button
                        type="button"
                        onClick={() => removeZip(zip)}
                        className="rounded-full p-0.5 hover:bg-slate-200 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Toggle
            checked={form.is_active}
            onChange={(val) => setForm((f) => ({ ...f, is_active: val }))}
            label="Active"
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              loading={saving}
              disabled={!form.name.trim() || !form.org_id}
            >
              {editingId ? 'Save Changes' : 'Add Territory'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Territory"
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete{' '}
          <span className="font-medium">{deleteTarget?.name}</span>? This action cannot be undone.
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

export { TerritoryManager };
