import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';

function OnboardingGuard() {
  const { orgId, isPlatformAdmin, membershipFetchFailed, loading, refreshMembership } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  // Fetch failed (RLS error, network timeout, etc.) — don't bounce to onboarding,
  // show an explicit error with retry so we don't kick existing users into a setup flow.
  if (membershipFetchFailed && !orgId && !isPlatformAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-slate-900">We couldn't load your account</h1>
          <p className="mt-2 text-sm text-slate-500">
            There was a problem reading your team membership. Check your connection and try again.
            If this keeps happening, please contact support.
          </p>
          <button
            onClick={() => refreshMembership()}
            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Reps who haven't completed onboarding have no team_member record yet → orgId is null
  if (!orgId && !isPlatformAdmin) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

export { OnboardingGuard };
