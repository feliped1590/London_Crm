import { lazy, ComponentType, LazyExoticComponent } from 'react';
import { matchPath } from 'react-router-dom';
import { ShoppingCart, Users, UserPlus, UserCog } from 'lucide-react';

/**
 * Registry das rotas-piloto que rodam dentro do Workspace.
 * Cada entrada descreve como casar a URL, identificar a aba e renderizar o componente.
 */

export interface WorkspaceRouteDef {
  /** Padrão de rota (mesmo formato do react-router). */
  pattern: string;
  /** Componente lazy a ser montado dentro do MemoryRouter da aba. */
  component: LazyExoticComponent<ComponentType<unknown>>;
  /** Ícone exibido na aba. */
  icon: ComponentType<{ className?: string }>;
  /** Gera o id da aba a partir dos params (cada id = 1 instância montada). */
  tabId: (params: Record<string, string | undefined>) => string;
  /** Título padrão da aba (pode ser sobrescrito via useWorkspaceTab). */
  defaultTitle: (params: Record<string, string | undefined>) => string;
}

export const WORKSPACE_ROUTES: WorkspaceRouteDef[] = [
  {
    pattern: '/orders',
    component: lazy(() => import('@/pages/Orders')),
    icon: ShoppingCart,
    tabId: () => 'orders',
    defaultTitle: () => 'Pedidos',
  },
  {
    pattern: '/customers/new',
    component: lazy(() => import('@/pages/CustomerNew')),
    icon: UserPlus,
    tabId: () => 'customers:new',
    defaultTitle: () => 'Novo cliente',
  },
  {
    pattern: '/customers/:id',
    component: lazy(() => import('@/pages/CustomerDetail')),
    icon: UserCog,
    tabId: (p) => `customers:${p.id ?? 'unknown'}`,
    defaultTitle: (p) => `Cliente ${p.id?.slice(0, 6) ?? ''}`,
  },
  {
    pattern: '/customers',
    component: lazy(() => import('@/pages/Customers')),
    icon: Users,
    tabId: () => 'customers',
    defaultTitle: () => 'Clientes',
  },
];

export interface MatchedWorkspaceRoute {
  def: WorkspaceRouteDef;
  params: Record<string, string | undefined>;
  tabId: string;
}

/**
 * Tenta casar um pathname com alguma rota-piloto.
 * Retorna `null` quando a rota não pertence ao Workspace.
 */
export function matchWorkspaceRoute(pathname: string): MatchedWorkspaceRoute | null {
  for (const def of WORKSPACE_ROUTES) {
    const m = matchPath({ path: def.pattern, end: true }, pathname);
    if (m) {
      const params = (m.params ?? {}) as Record<string, string | undefined>;
      return { def, params, tabId: def.tabId(params) };
    }
  }
  return null;
}

export function isWorkspacePath(pathname: string): boolean {
  return matchWorkspaceRoute(pathname) !== null;
}
