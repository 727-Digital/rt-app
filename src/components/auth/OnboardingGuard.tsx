import { Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';

function OnboardingGuard() {
  const { loading, membershipFetchFailed, orgId, isPlatformAdmin, refreshMembership } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  // Fetch failed (RLS error, network timeout, etc.) — show an explicit error with retry.
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

  // Onboarding redirect intentionally disabled — users without a team_member row
  // now land on the dashboard like everyone else. New-rep self-signup can still
  // navigate to /onboarding directly via the public Signup flow.
  return <Outlet />;
}

export { OnboardingGuard };
