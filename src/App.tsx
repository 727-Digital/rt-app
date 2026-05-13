import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from '@/pages/Login';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { OnboardingGuard } from '@/components/auth/OnboardingGuard';
import { Shell } from '@/components/layout/Shell';
import { Spinner } from '@/components/ui/Spinner';

// Eagerly bundle the screens reps hit every day. Lazy-loading these added a
// chunk-fetch on every navigation, including push-notification cold starts
// where the rep would stare at a spinner for several seconds while React
// downloaded LeadDetail.js after the route already resolved. The combined
// cost (~30kB gzip) shifts to first-paint where it overlaps with Capacitor
// boot and the initial Supabase fetch anyway.
import Dashboard from '@/pages/Dashboard';
import Leads from '@/pages/Leads';
import LeadDetail from '@/pages/LeadDetail';
import Messages from '@/pages/Messages';

// Lower-traffic screens stay lazy.
const Calendar = lazy(() => import('@/pages/Calendar'));
const Customers = lazy(() => import('@/pages/Customers'));
const Quotes = lazy(() => import('@/pages/Quotes'));
const QuoteBuilder = lazy(() => import('@/pages/QuoteBuilder'));
const Training = lazy(() => import('@/pages/Training'));
const Financials = lazy(() => import('@/pages/Financials'));
const Organizations = lazy(() => import('@/pages/Organizations'));
const Settings = lazy(() => import('@/pages/Settings'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
const Signup = lazy(() => import('@/pages/Signup'));
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'));
const ResetPassword = lazy(() => import('@/pages/ResetPassword'));
const JoinAsRep = lazy(() => import('@/pages/public/JoinAsRep'));
const QuoteView = lazy(() => import('@/pages/public/QuoteView'));
const ReviewLanding = lazy(() => import('@/pages/public/ReviewLanding'));

function SuspenseFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size={32} />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/join" element={<JoinAsRep />} />
        <Route path="/q/:quoteId" element={<QuoteView />} />
        <Route path="/review/:leadId" element={<ReviewLanding />} />
        <Route element={<ProtectedRoute />}>
          <Route path="onboarding" element={<Onboarding />} />
          <Route element={<OnboardingGuard />}>
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="messages" element={<Messages />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetail />} />
            <Route path="customers" element={<Customers />} />
            <Route path="quotes" element={<Quotes />} />
            <Route path="quotes/new" element={<QuoteBuilder />} />
            <Route path="quotes/new/:leadId" element={<QuoteBuilder />} />
            <Route path="quotes/:id/edit" element={<QuoteBuilder />} />
            <Route path="training" element={<Training />} />
            <Route path="financials" element={<Financials />} />
            <Route path="organizations" element={<Organizations />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
