import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider } from "@/hooks/useAuth";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
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

import Help from "./pages/Help";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Componente que monitora mudanças de autenticação e limpa o cache apenas quando necessário
function AuthStateListener() {
  const qc = useQueryClient();
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Obter sessão inicial para rastrear o usuário atual
    supabase.auth.getSession().then(({ data: { session } }) => {
      previousUserIdRef.current = session?.user?.id ?? null;
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const currentUserId = session?.user?.id ?? null;
        const previousUserId = previousUserIdRef.current;

        // Só limpar cache se realmente mudou de usuário (não apenas restauração de sessão)
        if (event === 'SIGNED_OUT') {
          console.log('User signed out - Clearing React Query cache');
          qc.clear();
          previousUserIdRef.current = null;
        } else if (event === 'SIGNED_IN' && previousUserId !== currentUserId) {
          console.log('New user signed in - Clearing React Query cache');
          qc.clear();
          previousUserIdRef.current = currentUserId;
        }
        // Ignora SIGNED_IN quando é apenas restauração de sessão do mesmo usuário
      }
    );

    return () => subscription.unsubscribe();
  }, [qc]);

  return null;
}

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AuthStateListener />
      <AuthProvider>
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
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/whatsapp" element={<WhatsApp />} />
                <Route path="/bots" element={<Bots />} />
                <Route path="/bots/:id" element={<BotBuilder />} />
                <Route path="/emails" element={<Emails />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/pricing" element={<PricingTables />} />
                <Route path="/prospecting" element={<Prospecting />} />
                <Route path="/reallocation" element={<Navigate to="/settings?tab=portfolio" replace />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/integrations" element={<Integrations />} />
                <Route path="/help" element={<Help />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
        </SidebarProvider>
      </AuthProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;