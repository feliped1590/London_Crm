// Mapeia rotas para os mesmos imports usados em src/App.tsx.
// Quando o usuário passa o mouse sobre um item de menu, disparamos o import()
// correspondente para baixar o chunk antes do clique — tornando a navegação
// quase instantânea.
//
// Importante: as funções abaixo precisam ser exatamente as mesmas referências
// usadas pelos lazy() em App.tsx? Não — basta que o Vite resolva para o mesmo
// chunk. Vite deduplica os imports dinâmicos por especificador estático.

type Loader = () => Promise<unknown>;

const loaders: Record<string, Loader> = {
  '/today': () => import('@/pages/Today'),
  '/dashboard': () => import('@/pages/Dashboard'),
  '/customers': () => import('@/pages/Customers'),
  '/customers/new': () => import('@/pages/CustomerNew'),
  '/companies': () => import('@/pages/Companies'),
  '/contacts': () => import('@/pages/Contacts'),
  '/pipeline': () => import('@/pages/Pipeline'),
  '/products': () => import('@/pages/Products'),
  '/orders': () => import('@/pages/Orders'),
  '/stock': () => import('@/pages/Stock'),
  '/carriers': () => import('@/pages/Carriers'),
  '/tasks': () => import('@/pages/Tasks'),
  '/emails': () => import('@/pages/Emails'),
  '/reports': () => import('@/pages/Reports'),
  '/insights': () => import('@/pages/Insights'),
  '/prospecting': () => import('@/pages/Prospecting'),
  '/settings': () => import('@/pages/Settings'),
  '/integrations': () => import('@/pages/Integrations'),
  '/import-companies': () => import('@/pages/ImportCompanies'),
};

const prefetched = new Set<string>();

export function prefetchRoute(path: string) {
  // normaliza removendo query/hash
  const base = path.split('?')[0].split('#')[0];
  if (prefetched.has(base)) return;
  const loader = loaders[base];
  if (!loader) return;
  prefetched.add(base);
  // Dispara import sem aguardar; falhas silenciosas (re-tenta no clique normalmente).
  loader().catch(() => prefetched.delete(base));
}

// Pré-carrega rotas mais usadas em idle após login/boot.
export function prefetchTopRoutesIdle() {
  const top = ['/today', '/customers', '/pipeline'];
  const run = () => top.forEach(prefetchRoute);
  if (typeof window === 'undefined') return;
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout?: number }) => number)
    | undefined;
  if (ric) ric(run, { timeout: 3000 });
  else setTimeout(run, 1500);
}
