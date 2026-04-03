import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useBiometrics } from '@/hooks/useBiometrics';
import { isNative } from '@/lib/capacitor';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

export default function Login() {
  const { user, loading: authLoading, signIn } = useAuth();
  const navigate = useNavigate();
  const biometrics = useBiometrics();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [biometricAttempted, setBiometricAttempted] = useState(false);

  useEffect(() => {
    if (!biometricAttempted && user && biometrics.enabled && isNative) {
      setBiometricAttempted(true);
      biometrics.authenticate().then((ok) => {
        if (ok) navigate('/', { replace: true });
      });
    }
  }, [user, biometrics.enabled, biometricAttempted, navigate, biometrics]);

  if (authLoading) return null;
  if (user && !biometrics.enabled) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      if (isNative && biometrics.available && !biometrics.enabled) {
        setShowBiometricPrompt(true);
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  const biometricLabel = biometrics.biometryType === 'faceId' ? 'Face ID' : 'Touch ID';

  return (
    <div className="flex min-h-dvh items-start justify-center bg-slate-50 sm:items-center sm:pt-0" style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}>
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-emerald-600">TurfFlow</h1>
        <p className="mt-1 text-center text-sm text-slate-500">Sign in to your account</p>
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" variant="primary" loading={loading} className="w-full">
            Sign In
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Don't have an account?{' '}
          <Link to="/signup" className="font-medium text-emerald-600 hover:text-emerald-700">
            Sign up free
          </Link>
        </p>
      </div>

      <Modal
        open={showBiometricPrompt}
        onClose={() => { setShowBiometricPrompt(false); navigate('/'); }}
        title={`Enable ${biometricLabel}?`}
      >
        <p className="text-sm text-slate-600">
          Use {biometricLabel} for faster access next time you open the app.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setShowBiometricPrompt(false); navigate('/'); }}>
            Not Now
          </Button>
          <Button onClick={() => { biometrics.enable(); setShowBiometricPrompt(false); navigate('/'); }}>
            Enable {biometricLabel}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
