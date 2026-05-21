import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

// Step 2 of password reset: rep lands here from the email link. The
// supabase client auto-detects the recovery tokens in the URL hash and
// flips into a temporary recovery session, so calling auth.updateUser
// works without an additional verification step. After save, we sign
// them out of the recovery session and bounce to /login so they prove
// the new password works.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  // Listen for the PASSWORD_RECOVERY event so we know the user actually
  // arrived from a valid reset email (vs typing /reset-password directly).
  // If they arrived without a recovery session, we let them try anyway
  // and Supabase will reject the updateUser call with a clear error.
  const [recoveryReady, setRecoveryReady] = useState(false);

  useEffect(() => {
    // Check if there's already a session (handles the case where the
    // hash-based recovery token was processed before this component mounted).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setRecoveryReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setRecoveryReady(true);
      }
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      // Make sure we actually have a session before trying to update.
      // For invite/recovery hash-based redirects, supabase-js auto-
      // creates one — but if the hash got eaten by a redirect, refresh,
      // or browser extension, we'd silently fail with "Auth session
      // missing!". Catching it here gives the user a real message.
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (!currentSession) {
        setError(
          "Your invite link expired or was already used. Ask an admin to re-send the invitation.",
        );
        return;
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        console.error('[ResetPassword] updateUser failed:', updateErr);
        setError(updateErr.message);
        return;
      }
      setDone(true);
      // Force a clean sign-in with the new password rather than auto-routing
      // them in via the recovery session — confirms the password works.
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 1500);
    } catch (e) {
      // Network errors, unexpected throws — surface them so the user
      // doesn't see a silent spinner-then-nothing.
      console.error('[ResetPassword] handleSubmit threw:', e);
      setError(
        e instanceof Error ? e.message : 'Unexpected error updating password.',
      );
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
        <p className="mt-1 text-center text-sm text-slate-500">Set a new password</p>

        {done ? (
          <div className="mt-6 flex flex-col gap-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              <p className="font-medium">Password updated.</p>
              <p className="mt-1 text-xs">Redirecting you to sign in...</p>
            </div>
          </div>
        ) : (
          <>
            {!recoveryReady && (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                If you arrived here without clicking a reset email link, this
                page won't be able to save a new password. Start over from{' '}
                <Link to="/forgot-password" className="font-medium underline">
                  Forgot password
                </Link>
                .
              </div>
            )}
            <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
              <Input
                label="New password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
              />
              <Input
                label="Confirm password"
                type="password"
                placeholder="Type it again"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" variant="primary" loading={loading} className="w-full">
                Save new password
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
