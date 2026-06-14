import { Suspense, useEffect } from 'react';
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { WORKSPACE_ROUTES, matchWorkspaceRoute } from './registry';
import { useWorkspace, WorkspaceTab } from './WorkspaceContext';
import { cn } from '@/lib/utils';

/**
 * Renderiza TODAS as abas do Workspace lado a lado, mantendo as inativas
 * em `display:none` para preservar seu estado de formulário e DOM.
 * Cada aba vive dentro do seu próprio MemoryRouter, isolando
 * useLocation/useParams/useSearchParams da rota do navegador.
 */
export function WorkspaceHost() {
  const { tabs, activeTabId } = useWorkspace();

  return (
    <div className="workspace-host relative w-full">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          // `display:none` desliga a árvore para o usuário mas mantém o DOM montado.
          className={cn(tab.id === activeTabId ? 'block' : 'hidden')}
          aria-hidden={tab.id !== activeTabId}
        >
          <TabFrame tab={tab} isActive={tab.id === activeTabId} />
        </div>
      ))}
    </div>
  );
}

function TabFrame({ tab, isActive }: { tab: WorkspaceTab; isActive: boolean }) {
  return (
    <MemoryRouter initialEntries={[tab.initialPath]} initialIndex={0}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-[40vh]">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        }
      >
        <TabInner tab={tab} isActive={isActive} />
      </Suspense>
    </MemoryRouter>
  );
}

function TabInner({ tab, isActive }: { tab: WorkspaceTab; isActive: boolean }) {
  const innerLocation = useLocation();
  const innerNavigate = useNavigate();
  const { syncTabPath, openOrActivate } = useWorkspace();
  const outerNavigate = useOuterNavigate();

  const innerFull = innerLocation.pathname + innerLocation.search;
  const expected = matchWorkspaceRoute(innerLocation.pathname);
  const expectedTabId = expected?.tabId ?? null;

  // Bridge: se a navegação interna da aba aponta para OUTRA entidade do Workspace,
  // abre como nova aba e devolve esta aba ao seu path original.
  useEffect(() => {
    if (!expectedTabId) return;
    if (expectedTabId !== tab.id) {
      openOrActivate(innerFull);
      // Volta o MemoryRouter desta aba ao path original para preservar estado.
      innerNavigate(tab.initialPath, { replace: true });
      return;
    }
    // Mesma aba: atualiza currentPath e (se ativa) reflete no URL do navegador.
    syncTabPath(tab.id, innerFull);
    if (isActive) {
      outerNavigate(innerFull);
    }
  }, [innerFull, expectedTabId, isActive, tab.id, tab.initialPath, openOrActivate, innerNavigate, syncTabPath, outerNavigate]);

  return (
    <Routes>
      {WORKSPACE_ROUTES.map((def) => (
        <Route
          key={def.pattern}
          path={def.pattern}
          element={<RouteElement def={def} tab={tab} />}
        />
      ))}
    </Routes>
  );
}

function RouteElement({
  def,
  tab,
}: {
  def: (typeof WORKSPACE_ROUTES)[number];
  tab: WorkspaceTab;
}) {
  const Comp = def.component as unknown as React.ComponentType<{ workspaceTabId?: string }>;
  return <Comp workspaceTabId={tab.id} />;
}

/**
 * Hook para acessar o `navigate` do roteador EXTERNO (BrowserRouter) de dentro
 * do MemoryRouter. Usa um pequeno truque: o WorkspaceHost expõe o navigate
 * externo via contexto montado fora do MemoryRouter.
 */
import { createContext, useContext } from 'react';

const OuterNavigateContext = createContext<((to: string) => void) | null>(null);

export function OuterNavigateProvider({
  navigate,
  children,
}: {
  navigate: (to: string) => void;
  children: React.ReactNode;
}) {
  return (
    <OuterNavigateContext.Provider value={navigate}>{children}</OuterNavigateContext.Provider>
  );
}

function useOuterNavigate(): (to: string) => void {
  const fn = useContext(OuterNavigateContext);
  return fn ?? (() => {});
}
