import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/useAuth";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { AppInitializer } from "@/components/AppInitializer";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useAuth } from "@/hooks/useAuth";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Today from "./pages/Today";
import Companies from "./pages/Companies";
import Contacts from "./pages/Contacts";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import CustomerNew from "./pages/CustomerNew";
import Pipeline from "./pages/Pipeline";
import Tasks from "./pages/Tasks";
import Emails from "./pages/Emails";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import WhatsApp from "./pages/WhatsApp";
import Integrations from "./pages/Integrations";
import Products from "./pages/Products";
import Orders from "./pages/Orders";
import Bots from "./pages/Bots";
import BotBuilder from "./pages/BotBuilder";
import ProposalPublic from "./pages/ProposalPublic";
import Insights from "./pages/Insights";
import PricingTables from "./pages/PricingTables";
import Prospecting from "./pages/Prospecting";
import Stock from "./pages/Stock";
import Carriers from "./pages/Carriers";
import ImportCompanies from "./pages/ImportCompanies";

import Help from "./pages/Help";
import NotFound from "./pages/NotFound";

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

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'CRM_QUERY_CACHE',
  // Limitar tamanho: se serialização falhar por quota, remove silenciosamente
  retry: ({ persistedClient, error, errorCount }) => {
    if (errorCount > 1) {
      // Não tenta mais, remove cache corrompido/excedido
      window.localStorage.removeItem('CRM_QUERY_CACHE');
      return undefined;
    }
    // Na primeira falha, tenta remover queries maiores
    if (persistedClient) {
      const queries = persistedClient.clientState.queries;
      // Manter no máximo 30 queries persistidas (as mais recentes)
      if (queries.length > 30) {
        persistedClient.clientState.queries = queries
          .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
          .slice(0, 30);
      }
      return persistedClient;
    }
    return undefined;
  },
});

const persistOptions = {
  persister,
  maxAge: 10 * 60 * 1000, // 10 minutos
  buster: 'crm-cache-v1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: any) => {
      // Só persistir queries com sucesso
      if (query.state.status !== 'success') return false;

      const keyStr = JSON.stringify(query.queryKey).toLowerCase();

      // Bloquear queries sensíveis/voláteis
      if (BLOCKED_QUERY_KEYS.some(blocked => keyStr.includes(blocked))) {
        return false;
      }

      // Persistir apenas queries estruturais (whitelist)
      return PERSISTABLE_QUERY_KEYS.some(allowed => keyStr.includes(allowed));
    },
  },
};

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
          previousUserIdRef.current = null;
        } else if (event === 'SIGNED_IN' && previousUserId !== currentUserId) {
          console.log('New user signed in - Clearing React Query cache + persisted cache');
          qc.clear();
          window.localStorage.removeItem('CRM_QUERY_CACHE');
          previousUserIdRef.current = currentUserId;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [qc]);

  return null;
}

// Initializes realtime subscriptions when authenticated
function RealtimeSync() {
  const { user } = useAuth();
  useRealtimeSync(user?.id);
  return null;
}

const App = () => (
  <BrowserRouter>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <AuthStateListener />
      <AuthProvider>
        <AppInitializer>
          <RealtimeSync />
          <ErrorBoundary>
            <SidebarProvider>
              <TooltipProvider>
              <Toaster />
              <Sonner />
              <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/proposta/:token" element={<ProposalPublic />} />
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
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
                <Route path="/whatsapp" element={<WhatsApp />} />
                
                <Route path="/bots/:id" element={<BotBuilder />} />
                <Route path="/emails" element={<Emails />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/pricing" element={<Navigate to="/settings?tab=order-approval" replace />} />
                <Route path="/prospecting" element={<Prospecting />} />
                <Route path="/reallocation" element={<Navigate to="/settings?tab=portfolio" replace />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/import-companies" element={<ImportCompanies />} />
                <Route path="/help" element={<Help />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
              </Routes>
            </TooltipProvider>
            </SidebarProvider>
          </ErrorBoundary>
        </AppInitializer>
      </AuthProvider>
    </PersistQueryClientProvider>
  </BrowserRouter>
);

export default App;
