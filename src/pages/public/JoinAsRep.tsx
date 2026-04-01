import { useState } from 'react';
import { CheckCircle2, MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function JoinAsRep() {
  const [form, setForm] = useState({ name: '', email: '', company_name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email || !form.company_name) return;
    setSaving(true);
    setError('');
    try {
      const { error: insertError } = await supabase
        .from('rep_applications')
        .insert({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          company_name: form.company_name.trim(),
          phone: form.phone.trim() || null,
        });
      if (insertError) throw insertError;
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600">
            <CheckCircle2 size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Application received!</h1>
          <p className="mt-3 text-slate-500">
            We'll review your application and reach out to{' '}
            <span className="font-medium text-slate-700">{form.email}</span> within 1–2 business days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600">
            <MapPin size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Become a Turf Rep</h1>
          <p className="mt-2 text-sm text-slate-500">
            We supply the leads. You close the deals. Apply below and we'll be in touch.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Your name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Andy Huffman"
            />
            <Input
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="andy@yourcompany.com"
            />
            <Input
              label="Company name"
              required
              value={form.company_name}
              onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              placeholder="Pro Green South, LLC"
            />
            <Input
              label="Phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="(850) 555-1234"
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="mt-2 w-full" loading={saving}>
              Submit Application
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Already have an account?{' '}
          <a href="/login" className="text-emerald-600 hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
