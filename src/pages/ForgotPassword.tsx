import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

// Step 1 of password reset: rep types their email, we ask Supabase to send
// a recovery email. The email link lands on /reset-password where they
// pick a new password. Always shows the same success message regardless
// of whether the email matched an account — prevents account enumeration.
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // redirectTo must match a URL allow-listed in Supabase Auth → URL
      // Configuration → Redirect URLs. Set there to:
      //   https://app.reliableturf.com/reset-password
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Show success either way — don't leak whether the email exists.
      if (resetErr) console.error('reset email error:', resetErr);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-dvh items-start justify-center bg-slate-50 sm:items-center sm:pt-0"
      style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}
    >
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-emerald-600">TurfFlow</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Reset your password</p>

        {sent ? (
          <div className="mt-6 flex flex-col gap-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-medium">Check your email.</p>
              <p className="mt-1 text-xs">
                If an account exists for <span className="font-medium">{email}</span>, we
                just sent a reset link. The link expires in 1 hour.
              </p>
            </div>
            <Link
              to="/login"
              className="text-center text-sm font-medium text-emerald-600 hover:text-emerald-700"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" variant="primary" loading={loading} className="w-full">
                Send reset link
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-slate-500">
              Remembered it?{' '}
              <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
