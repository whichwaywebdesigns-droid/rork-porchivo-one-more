import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";

import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import CorrugatedBackground from "@/components/CorrugatedBackground";
import PostHogPageView from "./components/PostHogPageView";
import TapeDispenserSpinner from "@/components/TapeDispenserSpinner";

import Index from "./pages/Index";

const Features = lazy(() => import("./pages/Features"));
const Pricing = lazy(() => import("./pages/Pricing"));
const UseCases = lazy(() => import("./pages/UseCases"));
const About = lazy(() => import("./pages/About"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Changelog = lazy(() => import("./pages/Changelog"));
const Download = lazy(() => import("./pages/Download"));
const ForAgents = lazy(() => import("./pages/ForAgents"));
const Guide = lazy(() => import("./pages/Guide"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Settings = lazy(() => import("./pages/Settings"));
const EmailPreview = lazy(() => import("./pages/EmailPreview"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AuthFail = lazy(() => import("./pages/AuthFail"));

// Manager portal — lazy so supabase-js stays out of the marketing bundle.
// PortalAuthProvider is a default export purely for this lazy() import.
const PortalAuthProvider = lazy(() => import("./providers/PortalAuthProvider"));
const ManageLayout = lazy(() => import("./components/portal/ManageLayout"));
const ManageLoginPage = lazy(() => import("./pages/portal/ManageLogin"));
const ManageDashboardPage = lazy(() => import("./pages/portal/ManageDashboard"));
const ManageMembersPage = lazy(() => import("./pages/portal/ManageMembers"));
const ManageInviteCodePage = lazy(() => import("./pages/portal/ManageInviteCode"));
const ManageAnnouncementsPage = lazy(() => import("./pages/portal/ManageAnnouncements"));
const ManageMaintenancePage = lazy(() => import("./pages/portal/ManageMaintenance"));
const ManageDocumentsPage = lazy(() => import("./pages/portal/ManageDocuments"));
const ManageAmenitiesPage = lazy(() => import("./pages/portal/ManageAmenities"));
const ManageLedgerPage = lazy(() => import("./pages/portal/ManageLedger"));
const ManageApiKeysPage = lazy(() => import("./pages/portal/ManageApiKeys"));
const ManageBillingPage = lazy(() => import("./pages/portal/ManageBilling"));

const queryClient = new QueryClient();

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const PageLoader = () => (
  <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
    {/* Tape-dispenser loading roll (was a plain bordered-circle spinner) */}
    <TapeDispenserSpinner size={44} />
  </div>
);

/**
 * The Expo web app lives at /app/index.html. The static host's catch-all
 * serves this marketing shell for /app/* paths (its _redirects file isn't
 * honored), so bounce those URLs to the real app entry.
 */
const AppRedirect = () => {
  useEffect(() => {
    window.location.replace("/app/index.html");
  }, []);
  return <PageLoader />;
};

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CorrugatedBackground />
          <ScrollToTop />
          <PostHogPageView />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/features" element={<Features />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/use-cases" element={<UseCases />} />
              <Route path="/porch-partners" element={<Navigate to="/" replace />} />
              <Route path="/about" element={<About />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/changelog" element={<Changelog />} />
              <Route path="/download" element={<Download />} />
              <Route path="/for-agents" element={<ForAgents />} />
              <Route path="/guide" element={<Guide />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/email-preview" element={<EmailPreview />} />
              <Route path="/auth-fail" element={<AuthFail />} />

              {/* Expo web app — host catch-all can't serve /app/ directly */}
              <Route path="/app" element={<AppRedirect />} />
              <Route path="/app/*" element={<AppRedirect />} />

              {/* ── Manager portal (magic-link login, staff-role gated) ── */}
              <Route
                path="/manage/login"
                element={
                  <PortalAuthProvider>
                    <ManageLoginPage />
                  </PortalAuthProvider>
                }
              />
              <Route
                path="/manage"
                element={
                  <PortalAuthProvider>
                    <ManageLayout />
                  </PortalAuthProvider>
                }
              >
                <Route index element={<ManageDashboardPage />} />
                <Route path="members" element={<ManageMembersPage />} />
                <Route path="invite-code" element={<ManageInviteCodePage />} />
                <Route path="announcements" element={<ManageAnnouncementsPage />} />
                <Route path="maintenance" element={<ManageMaintenancePage />} />
                <Route path="documents" element={<ManageDocumentsPage />} />
                <Route path="amenities" element={<ManageAmenitiesPage />} />
                <Route path="ledger" element={<ManageLedgerPage />} />
                <Route path="api" element={<ManageApiKeysPage />} />
                <Route path="billing" element={<ManageBillingPage />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
