import { lazy, Suspense, useEffect } from "react";
import { Switch, Route, Router, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataProvider, useData } from "@/lib/DataContext";
import { AuthProvider, useAuth } from "@/lib/auth";
import Login from "@/pages/login";
import Register from "@/pages/register";
import DashboardList from "@/pages/dashboard-list";
import Upload from "@/pages/upload";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const SavedView = lazy(() => import("@/pages/saved-view"));
const SharedView = lazy(() => import("@/pages/shared-view"));

function PageLoader() {
  return <div className="min-h-dvh flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
}

function AppRouter() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user && !window.location.pathname.startsWith("/s/") && !window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading) return <PageLoader />;

  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/s/:token" component={(p: { params: { token: string } }) => <SharedView token={p.params.token} />} />
        {user && (
          <>
            <Route path="/" component={DashboardList} />
            <Route path="/upload" component={Upload} />
            <Route path="/d/:id" component={(p: { params: { id: string } }) => <SavedView id={p.params.id} />} />
            <Route path="/settings" component={Settings} />
            <Route path="/dashboard" component={Dashboard} />
          </>
        )}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <AuthProvider>
      <TooltipProvider>
        <DataProvider>
          <Toaster />
          <Router><AppRouter /></Router>
        </DataProvider>
      </TooltipProvider>
    </AuthProvider>
  );
}

export default App;
