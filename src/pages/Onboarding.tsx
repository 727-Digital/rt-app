import { useState, KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, X, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function Onboarding() {
  const { user, refreshMembership } = useAuth();
  const navigate = useNavigate();

  const companyName = user?.user_metadata?.pending_org_id
    ? (user.user_metadata.pending_name || user?.email?.split('@')[0] || 'Your Company')
    : '';

  const [zipInput, setZipInput] = useState('');
  const [zips, setZips] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addZip(raw: string) {
    const parts = raw.split(/[\s,]+/).map((z) => z.trim()).filter((z) => /^\d{5}$/.test(z));
    if (parts.length === 0) return;
    setZips((prev) => {
      const merged = [...prev];
      for (const z of parts) {
        if (!merged.includes(z)) merged.push(z);
      }
      return merged;
    });
    setZipInput('');
  }

  function removeZip(zip: string) {
    setZips((prev) => prev.filter((z) => z !== zip));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addZip(zipInput);
    }
  }

  async function handleSubmit() {
    if (zips.length === 0) {
      setError('Add at least one zip code to define your service area.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-onboarding`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ zip_codes: zips }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete setup');
      await refreshMembership();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600">
            <MapPin size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome to TurfFlow</h1>
          <p className="mt-2 text-sm text-slate-500">
            Last step — tell us where you work so we can route leads to you.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Your company</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{companyName}</p>
          </div>

          <div className="mb-1">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Service area zip codes
            </label>
            <Input
              value={zipInput}
              onChange={(e) => setZipInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => { if (zipInput.trim()) addZip(zipInput); }}
              placeholder="e.g. 30126, 30127, 30301"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Type a zip code and press Enter or comma to add. You can add more later.
            </p>
          </div>

          {zips.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {zips.map((zip) => (
                <span
                  key={zip}
                  className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                >
                  {zip}
                  <button
                    type="button"
                    onClick={() => removeZip(zip)}
                    className="ml-0.5 text-emerald-400 hover:text-emerald-700"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}

          <Button
            className="mt-6 w-full"
            onClick={handleSubmit}
            loading={saving}
            disabled={zips.length === 0}
          >
            <CheckCircle2 size={16} />
            Finish Setup
          </Button>
        </div>
      </div>
    </div>
  );
}
