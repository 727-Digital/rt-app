import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from '@/pages/Login';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { OnboardingGuard } from '@/components/auth/OnboardingGuard';
import { Shell } from '@/components/layout/Shell';
import { Spinner } from '@/components/ui/Spinner';

const Calendar = lazy(() => import('@/pages/Calendar'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Leads = lazy(() => import('@/pages/Leads'));
const LeadDetail = lazy(() => import('@/pages/LeadDetail'));
const Quotes = lazy(() => import('@/pages/Quotes'));
const QuoteBuilder = lazy(() => import('@/pages/QuoteBuilder'));
const Training = lazy(() => import('@/pages/Training'));
const Financials = lazy(() => import('@/pages/Financials'));
const Organizations = lazy(() => import('@/pages/Organizations'));
const Settings = lazy(() => import('@/pages/Settings'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));
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
        <Route path="/q/:quoteId" element={<QuoteView />} />
        <Route path="/review/:leadId" element={<ReviewLanding />} />
        <Route element={<ProtectedRoute />}>
          <Route path="onboarding" element={<Onboarding />} />
          <Route element={<OnboardingGuard />}>
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="leads" element={<Leads />} />
            <Route path="leads/:id" element={<LeadDetail />} />
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
