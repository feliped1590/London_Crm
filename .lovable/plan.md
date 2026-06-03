# Performance — Diagnóstico e Plano

## O que medimos agora

- **/customers** é a rota onde a lentidão aparece mais forte. `companies` tem **33.608 registros**.
- A função RPC `search_customers_paginated` faz, **em toda chamada**:
  - `CREATE TEMP TABLE` + `TRUNCATE` (custo fixo por request).
  - Varre a tabela `companies` inteira (Seq Scan) porque o filtro padrão é só `active=true` + 7 `LIKE '%texto%'` em colunas sem índice de trigrama (`name`, `fantasia`, `cnpj`, `city`, `email`, `contact_name`, `phone`).
  - `ORDER BY CASE WHEN ... THEN col END` impede uso de índice (`idx_companies_last_interaction_at` nunca é usado para o sort padrão).
- A função `get_customer_filter_options` materializa cidades/estados/segmentos de **todos** os 33k registros — roda 1x e é cacheada por 10min, mas o primeiro paint é caro.
- O Dashboard (carregado em rotas como `/today`) puxa **listas inteiras** (`tasks`, `deals`, `proposals`, `orders`, `order_items` com JOIN em `products`) sem `limit`. Hoje os volumes são pequenos (≤700 linhas cada), então não é o gargalo principal, mas o `order_items` faz JOIN N+1 e crescerá rápido.
- **Health do banco**: 33/60 conexões, 58% de memória, **850.893 transações abortadas** desde o boot — sintoma de RLS/erros em loop em algum lugar; precisa investigar à parte (provavelmente Realtime ou hook que reenviam mutation em erro).

## O que vamos fazer (em ordem de impacto)

### 1. Indexar busca de clientes (maior ganho perceptível)
Migração adicionando extensão e índices trigram + suporte ao sort padrão:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_companies_name_trgm
  ON companies USING gin (lower(name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_fantasia_trgm
  ON companies USING gin (lower(coalesce(fantasia,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_city_trgm
  ON companies USING gin (lower(coalesce(city,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_email_trgm
  ON companies USING gin (lower(coalesce(email,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_companies_contact_name_trgm
  ON companies USING gin (lower(coalesce(contact_name,'')) gin_trgm_ops);

-- só dígitos, para acelerar busca por cnpj/phone (sem regexp_replace por linha)
CREATE INDEX IF NOT EXISTS idx_companies_cnpj_digits
  ON companies (regexp_replace(coalesce(cnpj,''),'\D','','g'));
CREATE INDEX IF NOT EXISTS idx_companies_phone_digits
  ON companies (regexp_replace(coalesce(phone,''),'\D','','g'));

-- sort padrão "última interação" com filtro ativo
CREATE INDEX IF NOT EXISTS idx_companies_active_last_interaction
  ON companies (active, last_interaction_at DESC NULLS LAST);
```

### 2. Reescrever `search_customers_paginated`
- Remover `CREATE TEMP TABLE` e `TRUNCATE`. Substituir por um `WITH filtered AS (...)` único.
- Trocar `ORDER BY CASE WHEN ...` por 4 branches `IF v_sort_field = 'X' THEN RETURN QUERY ... END IF`, cada um com `ORDER BY` direto na coluna real (permite usar índice).
- Buscar `total_count` via `count(*) OVER ()` na própria CTE, evitando segundo `COUNT(*)` no temp table.
- Manter as `LEFT JOIN LATERAL` (custo OK porque só rodam nas 25 linhas da página).

### 3. Cortar payloads do Dashboard
Em `src/hooks/useDashboardData.ts`:
- `dashboard-order-items` (widget "Top Produtos"): substituir pelo RPC já existente `get_top_products` ou criar um novo (`top_products_aggregated(limit:=5)`) — não faz sentido trafegar **todas** as `order_items` para o cliente só para contar top 5.
- `dashboard-deals` / `dashboard-tasks` / `dashboard-orders` / `dashboard-proposals`: limitar a janela (ex.: últimos 12 meses) e adicionar `select` mínimo. Já têm `staleTime` 5min, mas o payload cresce sem teto.
- `enabled: !!user?.id` em todos — confirmar que não disparam fora do Dashboard (hoje os hooks rodam mesmo em `/customers` se algum widget mount). Mover para dentro do componente do Dashboard / `enabled` controlado por rota.

### 4. Investigar transações abortadas
Tarefa de follow-up: 850k rollbacks desde o boot é muito alto. Suspeitas: `useRealtimeSync` reescrevendo cache em loop, ou alguma mutation que falha em RLS e o componente reenvia. Vou adicionar log em desenvolvimento e abrir issue separada — **não** entra nesta entrega para manter escopo.

## Critérios de aceite

1. Abrir `/customers` (33k registros, sem busca, sort padrão) carrega a primeira página em < 400ms no backend (`explain analyze` do RPC).
2. Buscar por "madel" ou pelos primeiros dígitos de um CNPJ responde em < 300ms.
3. Dashboard "Top Produtos" não baixa mais a lista inteira de `order_items`.
4. Nenhuma regressão funcional: filtros, ordenação, paginação e badges (deals_count/won/lost) continuam corretos.

## Detalhes técnicos (para revisão)

- Arquivos tocados:
  - `supabase/migrations/<timestamp>_perf_companies_search.sql` (extensão + índices + nova versão da função).
  - `supabase/migrations/<timestamp>_top_products_rpc.sql` (RPC agregada).
  - `src/hooks/useDashboardData.ts` (substituir query de `order_items` pela RPC; adicionar filtro temporal nas demais).
- A reescrita da função mantém a **mesma assinatura** (`RETURNS TABLE(...)` igual). Nenhuma alteração no frontend de `/customers`.
- `pg_trgm` é extensão padrão do Postgres no Lovable Cloud, basta `CREATE EXTENSION IF NOT EXISTS`.
- Sem alteração em RLS / GRANTs (função é `SECURITY DEFINER` e já estava assim).
