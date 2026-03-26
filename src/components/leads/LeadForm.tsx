import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import type { Lead } from '@/lib/types';

interface LeadFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: LeadFormData) => void;
  initialData?: Partial<Lead>;
  loading?: boolean;
}

interface LeadFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  sqft: number;
  estimate_min: number;
  estimate_max: number;
  notes: string;
}

function LeadForm({ open, onClose, onSubmit, initialData, loading }: LeadFormProps) {
  const [form, setForm] = useState<LeadFormData>(() => ({
    name: initialData?.name ?? '',
    email: initialData?.email ?? '',
    phone: initialData?.phone ?? '',
    address: initialData?.address ?? '',
    sqft: initialData?.sqft ?? 0,
    estimate_min: initialData?.estimate_min ?? 0,
    estimate_max: initialData?.estimate_max ?? 0,
    notes: initialData?.notes ?? '',
  }));
  const [errors, setErrors] = useState<Partial<Record<keyof LeadFormData, string>>>({});

  function update<K extends keyof LeadFormData>(key: K, value: LeadFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function validate(): boolean {
    const next: Partial<Record<keyof LeadFormData, string>> = {};
    if (!form.name.trim()) next.name = 'Required';
    if (!form.email.trim()) next.email = 'Required';
    if (!form.phone.trim()) next.phone = 'Required';
    if (!form.address.trim()) next.address = 'Required';
    if (!form.sqft || form.sqft <= 0) next.sqft = 'Must be greater than 0';
    if (!form.estimate_min || form.estimate_min <= 0) next.estimate_min = 'Must be greater than 0';
    if (!form.estimate_max || form.estimate_max <= 0) next.estimate_max = 'Must be greater than 0';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit(form);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? 'Edit Lead' : 'Add New Lead'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Full Name"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          error={errors.name}
          required
        />
        <Input
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          error={errors.email}
          required
        />
        <Input
          label="Phone"
          type="tel"
          value={form.phone}
          onChange={(e) => update('phone', e.target.value)}
          error={errors.phone}
          required
        />
        <Input
          label="Address"
          value={form.address}
          onChange={(e) => update('address', e.target.value)}
          error={errors.address}
          required
        />
        <div className="grid grid-cols-3 gap-3">
          <Input
            label="Square Footage"
            type="number"
            value={form.sqft || ''}
            onChange={(e) => update('sqft', Number(e.target.value))}
            error={errors.sqft}
            required
          />
          <Input
            label="Estimate Min"
            type="number"
            value={form.estimate_min || ''}
            onChange={(e) => update('estimate_min', Number(e.target.value))}
            error={errors.estimate_min}
            required
          />
          <Input
            label="Estimate Max"
            type="number"
            value={form.estimate_max || ''}
            onChange={(e) => update('estimate_max', Number(e.target.value))}
            error={errors.estimate_max}
            required
          />
        </div>
        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => update('notes', e.target.value)}
          rows={3}
        />
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {initialData ? 'Save Changes' : 'Add Lead'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export { LeadForm };
export type { LeadFormData };
