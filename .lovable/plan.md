## Diagnóstico

Análise das estatísticas reais do banco (pg_stat_statements + pg_size). Os principais consumidores de I/O hoje são:

| Origem | Sintoma | Impacto |
|---|---|---|
| `net._http_response` (pg_net) | **367 MB de bloat** com apenas 2.617 linhas vivas — INSERT+DELETE constantes do worker | Disk write/read pesado contínuo |
| `get_dashboard_card_metrics()` | 2.084 chamadas, 1,85 s/chamada, **25 M block hits** — sem `staleTime` no React Query | Refetch a cada navegação |
| `get_lifecycle_counts()` | 2.595 chamadas, 1,69 s/chamada, 4.383 s totais | Pesa em todo carregamento do dashboard |
| `get_customer_filter_options()` | 2.171 chamadas, 1,4 s/chamada | Recarrega filtros toda hora |
| Listagem `companies` (PostgREST) | 3.365 chamadas, 354 ms, 3,1 M hits, ordena por `name` sem índice tenant-aware | Scan/sort caro |
| `search_customers_v2` (RPC) | 5.200 chamadas, 960 ms/chamada | Cada digitação dispara busca |
| 8 cron jobs `* * * * *` | dispatch-company/order/product-sync × 2 offsets cada | Workers acordam a cada minuto |
| Realtime em 8 tabelas grandes | 18 bi block hits no WAL reader | Reader gira em cima de `companies/products/orders` o tempo todo |

A barra laranja de 79% vem principalmente do bloat de `net._http_response` + RPCs sem cache + realtime em tabelas grandes.

## Plano de otimização (3 fases, sem upgrade)

### Fase 1 — Ganhos imediatos e seguros

**1.1 Limpar bloat do pg_net**
- `VACUUM FULL net._http_response` (libera ~360 MB de disco imediatamente).
- Reduzir retenção: hoje o cleanup mantém respostas antigas; encurtar para 1 hora.
- Reduzir frequência do worker de cleanup se aplicável.

**1.2 Cache no React Query — adicionar `staleTime` e `gcTime`**
Hooks afetados (todos sem `staleTime` hoje ou com valores baixos):
- `src/hooks/useDashboardCards.ts` (metrics) → `staleTime: 5 min`, `gcTime: 30 min`
- `src/components/dashboard/LifecyclePanel.tsx` → subir de 60 s para 5 min
- `src/pages/Customers.tsx` (filter options) → subir de 30 s para 10 min
- `src/hooks/useTodayData.ts`, `useDashboardData.ts`, `useSalesFunnelData.ts`, `useDashboardCards.ts` → revisar e padronizar `staleTime: 2–5 min`

Apenas redução de refetch já corta facilmente 50–70 % das chamadas pesadas.

**1.3 Throttle de cron jobs**
- `dispatch-company-sync-30s` + `-offset` → manter, mas pular execução quando a fila estiver vazia (early-exit na função). Mesmo padrão para order e product.
- Avaliar trocar `process-scheduled-emails` de `* * * * *` para `*/2 * * * *`.

### Fase 2 — Otimizações estruturais

**2.1 Índices faltantes em `companies`**
- Índice composto para listagem padrão: `(tenant_id, name)` e/ou parcial por status.
- Confirmar índice em `name COLLATE` para o `ORDER BY name`.

**2.2 Refatorar RPCs pesados**
- `get_dashboard_card_metrics()` e `get_lifecycle_counts()`: avaliar se podem virar **materialized view** atualizada a cada 5 min via cron, em vez de calcular on-the-fly.
- `get_customer_filter_options()`: hoje devolve listas estáticas (setores, segmentos, atividades); ou cacheia mais agressivamente no client, ou vira view materializada.

**2.3 Revisar Realtime publication**
Tabelas atualmente publicadas: `companies, company_products, deals, order_sync_queue, orders, product_sync_queue, products, tasks`.
- `companies` e `products` são as duas maiores e mais escritas — provavelmente não precisam de Realtime broadcast global. Avaliar remover do publication e usar invalidação por React Query manual após mutações.
- Manter Realtime só em `tasks`, `deals`, filas de sync.

### Fase 3 — Só se ainda for necessário

- Upgrade da instância no painel **Cloud → Advanced settings**.

## Ordem de execução proposta

1. `VACUUM FULL net._http_response` + ajuste de retenção (libera disco já).
2. Padronizar `staleTime` nos hooks de dashboard/filtros.
3. Reduzir cron jobs com early-exit em fila vazia.
4. Criar índices em `companies`.
5. Materializar `get_dashboard_card_metrics` e `get_lifecycle_counts`.
6. Limpar Realtime publication.
7. Reavaliar a barra de 79% — se ainda alta, aí sim upgrade.

## Detalhes técnicos

- VACUUM FULL trava a tabela; `net._http_response` é interna do pg_net, é seguro fazer fora de horário de pico.
- React Query: definir defaults globais em `src/main.tsx` (`defaultOptions.queries.staleTime`) também ajuda — hoje provavelmente está em 0.
- Para remover tabela da publication: `ALTER PUBLICATION supabase_realtime DROP TABLE public.companies;` (e `products`). Não impacta queries normais, só desativa eventos realtime.
- Materialized views: refresh `CONCURRENTLY` via cron a cada 5 min mantém dashboard reativo o suficiente.

## Fora do escopo

- Não vou mexer em lógica de negócio, RLS, fluxos de sync, ou modelos de dados.
- Não vou desligar nenhum cron crítico de sincronização ERP.
- Não vou alterar tamanho de instância sem confirmar que as otimizações não bastaram.
