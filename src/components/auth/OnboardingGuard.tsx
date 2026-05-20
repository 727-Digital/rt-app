import { Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/Spinner';

function OnboardingGuard() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  // Onboarding redirect + membership-error screen intentionally disabled.
  // Users always land on the dashboard regardless of team_members state.
  return <Outlet />;
}

export { OnboardingGuard };
