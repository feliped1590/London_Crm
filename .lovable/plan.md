
# Auditoria de Performance — Diagnóstico e Plano de Ação

Investiguei o app e encontrei gargalos sérios. Abaixo está o diagnóstico (com evidências de arquivo) e um plano em fases. Recomendo fortemente fazermos a **Fase 1** primeiro — ela sozinha deve resolver 70-80% da lentidão percebida sem nenhum risco de quebra.

---

## 🔴 Gargalos críticos encontrados

### 1. N+1 brutal nas listas (Orders / Customers / Products)
Cada linha da tabela monta um badge + botão de sincronização que faz:
- 1 `useQuery` para `order_sync_queue` (badge)
- 1 `useQuery` para `order_sync_queue` (botão) — **mesma tabela, query duplicada**
- 1 canal Realtime dedicado `order-sync-ui-${id}`
- Polling automático a cada **15s** (3s se pending)

**Evidência:** `src/components/orders/OrderSyncStatus.tsx:11-29, 86-106, 180-194` (mesmo padrão em `products/ProductSyncStatus.tsx:90-139` e `customers/CompanySyncStatus.tsx:80-98`).

**Impacto:** com 25 pedidos na tela → **50 requests + 25 WebSockets + refetch a cada 15s para sempre**. Você viu isso nos network logs: dezenas de chamadas `order_sync_queue?order_id=eq.X`. É o motivo principal da lentidão em `/orders`, `/customers` e `/products`.

### 2. Sem lazy loading / code-splitting
`src/App.tsx:19-48` importa **30+ páginas eagerly** no bundle inicial — incluindo:
- `Products.tsx` → **2369 linhas**
- `Customers.tsx` → 929 linhas
- `Pipeline.tsx` → 767 linhas
- `Dashboard.tsx` → 724 linhas
- `Settings.tsx`, `Insights.tsx`, `BotBuilder.tsx`, etc.

**Impacto:** o usuário baixa e parseia ~1MB+ de JS antes de ver qualquer tela. Primeiro carregamento (login → /today) é muito mais lento do que precisa.

### 3. Realtime global subscreve tabelas inteiras
`src/lib/realtimeManager.ts:19-39` subscreve `deals`, `companies`, `tasks` com `event: '*'` sem filtro. Qualquer mudança de qualquer registro no tenant dispara invalidações e re-renders mesmo em quem está em outra tela.

### 4. `useDashboardData` dispara 10 queries em paralelo
`src/hooks/useDashboardData.ts` faz 10 useQuery independentes (deals, tasks, companies, contacts, proposals, orders, products, orderItems…) sem `staleTime` agressivo e sem RPC consolidado. Ao abrir `/today` com a aba "visão geral" → 10 requests SQL.

### 5. `SELECT *` espalhado
**138 ocorrências** de `.select('*')` no projeto. Tabelas grandes (orders, companies, products) carregam colunas que a tela nem usa, incluindo blobs/JSON pesados.

### 6. Polling redundante mesmo quando ocioso
`refetchInterval: 15_000` em **OrderSyncBadge**, **ProductSyncBadge**, **CompanySyncBadge** roda eternamente mesmo quando o status é `completed`/`permanent_failure` (estados terminais que nunca mudam sozinhos).

### 7. Falta de memoização em páginas grandes
`Products.tsx` (2369 linhas) e `Customers.tsx` re-renderizam a tabela inteira a cada keystroke do filtro — sem `useMemo`/`useCallback` consistentes nem virtualização. Em 200+ linhas a digitação trava.

### 8. Query Client sem deduplicação por chave estável
323 chamadas `useQuery` no projeto. Várias páginas refazem queries idênticas com chaves levemente diferentes (ex.: filtros como objeto vs string) — React Query trata como queries diferentes e não deduplica.

---

## 🎯 Plano de ação priorizado (3 fases)

### **Fase 1 — Quick wins de altíssimo impacto** ⚡ (sem breaking changes)

| # | Mudança | Impacto esperado | Risco |
|---|---------|------------------|-------|
| 1.1 | **Consolidar sync status em 1 query agregada por página.** Em vez de cada linha pedir `order_sync_queue` individualmente, fazer **1 query** `in.(${orderIds})` no `Orders.tsx` (via React Query) e passar via props/contexto local para `OrderSyncBadge`/`OrderSyncButton`. Aplicar idêntico em Customers e Products. | -90% de requests nas listas. Carregamento "instantâneo" após pintura inicial. | Baixo |
| 1.2 | **Eliminar 1 canal Realtime por linha.** Substituir os `useOrderSyncRealtime(orderId)`/`useProductSyncRealtime` por **1 canal único** que escuta a tabela `*_sync_queue` filtrada pelos IDs visíveis na página, invalidando a query agregada. | -25 WebSockets simultâneos. CPU do browser cai muito. | Baixo |
| 1.3 | **Parar polling em estados terminais.** Em `OrderSyncBadge` / `ProductSyncBadge` / `CompanySyncBadge`, retornar `false` em `refetchInterval` quando status ∈ {completed, permanent_failure, blocked_validation, waiting_propagation}. Hoje retorna 15s. | -80% de requests "fantasma" em telas paradas. | Zero |
| 1.4 | **Lazy load + code-splitting de rotas.** Trocar todos os `import Page from …` em `App.tsx` por `lazy(() => import(…))` envolto em `<Suspense fallback={skeleton}>`. Manter `Auth`, `Today`, `AppLayout` eagerly (rota crítica). | Bundle inicial -60% a -70%. TTI muito menor no login. | Baixo |
| 1.5 | **Consolidar `useDashboardData` em RPC única.** Criar `get_dashboard_summary(p_user_id)` no Postgres que retorna o JSON com todos os contadores. Hook passa de 10 queries → 1. | `/today` carrega em ~1 request em vez de 10. | Médio (precisa migration) |

### **Fase 2 — Estruturais (melhoram escalabilidade)**

| # | Mudança | Impacto |
|---|---------|---------|
| 2.1 | **Migrar `SELECT *` das listas grandes** (orders, companies, products) para listas explícitas de colunas — só o que a tabela renderiza. Detalhe continua usando query separada com mais colunas. | -40% de payload nas listas; menos parsing JSON; menos pressão no PgBouncer. |
| 2.2 | **Filtro de Realtime global.** `realtimeManager.ts` passa a usar `filter: 'owner_id=eq.${userId}'` (ou tenant) para deals/companies/tasks — eventos de outros usuários não chegam ao browser. | Menos invalidações cruzadas; menos re-renders. |
| 2.3 | **Quebrar `Products.tsx` (2369 linhas) e `Customers.tsx` (929 linhas)** em sub-componentes (`ProductsTable`, `ProductsFilters`, `ProductsToolbar`) memoizados com `React.memo`. Filtros viram `useDeferredValue` para não bloquear digitação. | Digitação fluida em listas grandes; menos trabalho de reconciliação. |
| 2.4 | **Índices Postgres** para colunas usadas em filtros/orden. das listas: `orders(tenant_id, created_at desc)`, `order_sync_queue(order_id, created_at desc)`, `companies(tenant_id, active, name)`, `products(tenant_id, name)`. Validar via `EXPLAIN ANALYZE` antes/depois. | Queries de listagem de 800ms → <100ms em tenants grandes. |
| 2.5 | **Padrão único de query keys** (helpers `orderKeys.list(filters)`, `orderKeys.detail(id)`) para deduplicar requests entre componentes. | Cache realmente reaproveitado entre páginas. |

### **Fase 3 — Polimento de UX**

- Skeleton loading nas tabelas (não tela branca).
- `keepPreviousData` em todas as paginações (já existe em Orders, replicar em Customers/Products).
- Virtualização (`@tanstack/react-virtual`) para tabelas com >100 linhas (Products principalmente).
- Prefetch de página vizinha no hover do `Pagination`.
- Substituir `lucide-react` import full por imports diretos (já é tree-shakeable, mas validar via `rollup-plugin-visualizer`).

---

## 📊 Ganhos esperados (estimativa baseada nas evidências)

| Métrica | Hoje | Pós Fase 1 | Pós Fase 1+2 |
|---|---|---|---|
| Requests ao abrir `/orders` (25 itens) | ~55 | ~5 | ~3 |
| WebSockets simultâneos por aba | 28+ | 4 | 4 |
| Bundle JS inicial | ~1.2 MB | ~400 KB | ~350 KB |
| TTI no login | 4–6s | 1.5–2s | 1–1.5s |
| Requests ao abrir `/today` | 10+ | 10+ | 1 |
| Digitação em filtros da lista de produtos | trava 200-400ms/tecla | fluida | fluida |

---

## ⚠️ Princípios de execução

- **Zero breaking changes** em comportamento visível — todas as funcionalidades atuais preservadas (sync, realtime, filtros).
- Cada mudança é **isolada e reversível** (1 PR por item conforme você preferir).
- Validação após cada item: medir antes/depois com `browser--performance_profile` e network logs.
- Sem mexer em RLS, edge functions ou regras de negócio nesta auditoria.

---

## 👉 Próximo passo

Confirmando este plano, eu começo pela **Fase 1 inteira** (itens 1.1 a 1.5) em sequência, validando cada item antes do próximo. Quer que eu execute assim, ou prefere quebrar em PRs menores (ex.: só 1.1+1.2+1.3 primeiro, deixar 1.4 e 1.5 para depois)?
