import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';

function OnboardingGuard() {
  const { orgId, isPlatformAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} />
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
