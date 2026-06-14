import { lazy, Suspense, useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/useAuth";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppInitializer } from "@/components/AppInitializer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { VersionChecker } from "@/components/VersionChecker";
import { TopProgressBar } from "@/components/TopProgressBar";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useAuth } from "@/hooks/useAuth";
import { useLegalEntities } from "@/hooks/useLegalEntities";
import { LegalEntityGuard } from "@/components/auth/LegalEntityGuard";
import { prefetchTopRoutesIdle } from "@/lib/routePrefetch";
import { clearAllDrafts } from "@/workspace/drafts";


// Auth-critical (manter eager para evitar flash em rotas públicas/iniciais)
import Auth from "./pages/Auth";
import AccessBlocked from "./pages/AccessBlocked";
import NotFound from "./pages/NotFound";
import Today from "./pages/Today";

// Lazy-loaded (code-splitting). Carrega só quando a rota é visitada.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Companies = lazy(() => import("./pages/Companies"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const CustomerNew = lazy(() => import("./pages/CustomerNew"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Tasks = lazy(() => import("./pages/Tasks"));
const Emails = lazy(() => import("./pages/Emails"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const Integrations = lazy(() => import("./pages/Integrations"));
const Products = lazy(() => import("./pages/Products"));
const Orders = lazy(() => import("./pages/Orders"));
const Bots = lazy(() => import("./pages/Bots"));
const BotBuilder = lazy(() => import("./pages/BotBuilder"));
const ProposalPublic = lazy(() => import("./pages/ProposalPublic"));
const Insights = lazy(() => import("./pages/Insights"));
const PricingTables = lazy(() => import("./pages/PricingTables"));
const Prospecting = lazy(() => import("./pages/Prospecting"));
const Stock = lazy(() => import("./pages/Stock"));
const Carriers = lazy(() => import("./pages/Carriers"));
const ImportCompanies = lazy(() => import("./pages/ImportCompanies"));
const BICenter = lazy(() => import("./pages/BICenter"));
const NotificationsPage = lazy(() => import("./pages/Notifications"));

// Keys estruturais que devem ser persistidas no cache
const PERSISTABLE_QUERY_KEYS = [
  'user_modules',
  'is_admin',
  'is_developer',
  'pipelines',
  'pipeline_stages',
  'sales_reps',
  'legal_entities',
  'segmentos',
  'setores',
  'atividades',
  'profiles',
  'tenant',
];

// Keys que NUNCA devem ser persistidas (sensíveis/voláteis)
const BLOCKED_QUERY_KEYS = [
  'session',
  'validate',
  'auth',
  'app_session',
  'whatsapp_messages',
  'notifications',
];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Fallback leve para Suspense — não trava UI, apenas mantém layout limpo
function RouteFallback() {
  return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

// Componente que monitora mudanças de autenticação e limpa o cache apenas quando necessário
function AuthStateListener() {
  const qc = useQueryClient();
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      previousUserIdRef.current = session?.user?.id ?? null;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUserId = session?.user?.id ?? null;
        const previousUserId = previousUserIdRef.current;

        if (event === 'SIGNED_OUT') {
          console.log('User signed out - Clearing React Query cache + persisted cache');
          qc.clear();
          window.localStorage.removeItem('CRM_QUERY_CACHE');
          clearAllDrafts();
          previousUserIdRef.current = null;
        } else if (event === 'SIGNED_IN' && previousUserId !== currentUserId) {
          console.log('New user signed in - Clearing React Query cache + persisted cache');
          qc.clear();
          window.localStorage.removeItem('CRM_QUERY_CACHE');
          clearAllDrafts();
          previousUserIdRef.current = currentUserId;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [qc]);

  return null;
}

// Initializes realtime subscriptions only when authenticated AND with valid legal entity context.
// Garante que nenhum canal realtime conecta antes de isContextReady === true.
function RealtimeSync() {
  const { user } = useAuth();
  const { isContextReady } = useLegalEntities();
  useRealtimeSync(isContextReady ? user?.id : undefined);
  useEffect(() => {
    if (user?.id) prefetchTopRoutesIdle();
  }, [user?.id]);
  return null;
}

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthStateListener />
      <TopProgressBar />
      <VersionChecker />
      <AuthProvider>
        <AppInitializer>
          <RealtimeSync />
          <ErrorBoundary>
            <ThemeProvider>
            <SidebarProvider>
              <TooltipProvider>
              <Toaster />
              <Sonner />
              <Suspense fallback={<RouteFallback />}>
              <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/access-blocked" element={<AccessBlocked />} />
            <Route path="/proposta/:token" element={<ProposalPublic />} />
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<LegalEntityGuard><AppLayout /></LegalEntityGuard>}>
                <Route path="/today" element={<Today />} />
                <Route path="/dashboard" element={<Navigate to="/today?tab=visao-geral" replace />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/new" element={<CustomerNew />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/products" element={<Products />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/stock" element={<Stock />} />
                <Route path="/carriers" element={<Carriers />} />
                <Route path="/tasks" element={<Tasks />} />
                {/* WhatsApp desativado (auditoria perf 2026-05). Reativar trocando WHATSAPP_ENABLED em src/config/features.ts */}
                <Route path="/whatsapp" element={<Navigate to="/today" replace />} />
                
                <Route path="/bots/:id" element={<BotBuilder />} />
                <Route path="/emails" element={<Emails />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/bi" element={<BICenter />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/pricing" element={<Navigate to="/settings?tab=order-approval" replace />} />
                <Route path="/prospecting" element={<Prospecting />} />
                <Route path="/reallocation" element={<Navigate to="/settings?tab=portfolio" replace />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/import-companies" element={<ImportCompanies />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                
                
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
            </TooltipProvider>
            </SidebarProvider>
            </ThemeProvider>
          </ErrorBoundary>
        </AppInitializer>
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
