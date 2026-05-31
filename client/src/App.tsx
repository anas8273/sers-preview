// Initialize i18n (must be imported before any component that uses useTranslation)
import '@/lib/i18n';

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Link } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { lazy, Suspense } from "react";
import BottomNav from "./components/BottomNav";
import { useAuth } from "./_core/hooks/useAuth";

// Lazy load pages
const Home = lazy(() => import("./pages/Home"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const PerformanceEvidence = lazy(() => import("./pages/PerformanceEvidence"));
const CertificateBuilder = lazy(() => import("./pages/CertificateBuilder"));
const GradeAnalysis = lazy(() => import("./pages/GradeAnalysis"));
const CoverBuilder = lazy(() => import("./pages/CoverBuilder"));
const TreatmentPlan = lazy(() => import("./pages/TreatmentPlan"));
const SectionPage = lazy(() => import("./pages/SectionPage"));
const SharedPortfolio = lazy(() => import("./pages/SharedPortfolio"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const TemplateManager = lazy(() => import("./pages/TemplateManager"));
const SharedTemplate = lazy(() => import("./pages/SharedTemplate"));
const Store = lazy(() => import("./pages/Store"));
const PortfolioBuilder = lazy(() => import("./pages/PortfolioBuilder"));
const ReportCenter = lazy(() => import("./pages/ReportCenter"));
const SchoolRadio = lazy(() => import("./pages/SchoolRadio"));
const SmartCV = lazy(() => import("./pages/SmartCV"));
const ExamBuilder = lazy(() => import("./pages/ExamBuilder"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));

// Lazy load new e-commerce components
const WishlistPage = lazy(() => import("./components/ecommerce/WishlistPage"));

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]" dir="rtl">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500" style={{ fontFamily: "'Tajawal', sans-serif" }}>جاري التحميل...</p>
      </div>
    </div>
  );
}

/** Route-level admin guard — redirects unauthorized users */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true });
  if (loading) return <LoadingFallback />;
  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg border max-w-sm">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">غير مصرح</h2>
          <p className="text-sm text-gray-500 mb-4">هذه الصفحة متاحة للمسؤولين فقط</p>
          <Link href="/" className="inline-block px-6 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition">العودة للرئيسية</Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Switch>
        {/* Public pages */}
        <Route path={"/"} component={Home} />
        <Route path={"/login"} component={LoginPage} />
        <Route path={"/register"} component={RegisterPage} />

        {/* Main sections */}
        <Route path={"/performance-evidence"} component={PerformanceEvidence} />
        <Route path={"/certificates"} component={CertificateBuilder} />
        <Route path={"/grade-analysis"} component={GradeAnalysis} />
        <Route path={"/covers"} component={CoverBuilder} />
        <Route path={"/treatment-plans"} component={TreatmentPlan} />
        <Route path={"/reports"} component={ReportCenter} />
        <Route path={"/school-radio"} component={SchoolRadio} />
        <Route path={"/smart-cv"} component={SmartCV} />
        <Route path={"/exams"} component={ExamBuilder} />
        <Route path={"/portfolio"} component={PortfolioBuilder} />
        <Route path={"/store"} component={Store} />
        <Route path={"/dashboard"} component={UserDashboard} />

        {/* E-commerce */}
        <Route path={"/wishlist"} component={WishlistPage} />

        {/* Admin (protected with auth guard) */}
        <Route path={"/admin"}>{() => <AdminGuard><AdminDashboard /></AdminGuard>}</Route>
        <Route path={"/admin/templates"}>{() => <AdminGuard><TemplateManager /></AdminGuard>}</Route>
        <Route path={"/admin/templates/:id"}>{() => <AdminGuard><TemplateManager /></AdminGuard>}</Route>

        {/* Shared / Section */}
        <Route path={"/section/:sectionId"} component={SectionPage} />
        <Route path={"/share/:token"} component={SharedPortfolio} />
        <Route path={"/shared-template/:token"} component={SharedTemplate} />

        {/* 404 */}
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
          <BottomNav />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
