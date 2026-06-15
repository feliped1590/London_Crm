## Fase 0 — Correção e Validação da Base BI (revisada)

> Objetivo: garantir que `bi_sales_fact` reflita fielmente os pedidos **e continue refletindo** após o backfill, sem alterar relatórios atuais.

---

### 1. Causa-raiz (confirmada)

- `orders.order_date`: só é gravado pelo `erp-import-orders`. Pedidos criados na UI ficam `NULL`.
- `orders.sales_rep_id`: **nunca** é gravado pelo app — só lido com fallback para `companies.sales_rep_id`.
- `bi_sales_fact`: copia fiel — por isso 194/194 com NULL.
- `bi_sales_fact_queue`: 943 entradas pendentes, sem consumidor.
- Triggers `trg_bsf_orders` e `trg_bsf_order_items` estão ativos e enfileirando.

---

### 2. Entregas da Fase 0 (uma única migration, 4 frentes)

#### Frente A — Trigger `set_order_defaults` (BEFORE INSERT OR UPDATE em `orders`)
Resolve em um único ponto todos os caminhos de criação (UI, edge functions, import, automações).

- Se `NEW.order_date IS NULL` → `(COALESCE(NEW.created_at, now()) AT TIME ZONE COALESCE(get_tenant_timezone(NEW.tenant_id),'America/Sao_Paulo'))::date`.
- Se `NEW.sales_rep_id IS NULL AND NEW.company_id IS NOT NULL` → `SELECT sales_rep_id FROM companies WHERE id = NEW.company_id`.
- **Nunca sobrescreve** valor já informado.

#### Frente B — Backfill seguro (em transação, após snapshot)
```sql
CREATE TABLE _bi_phase0_snapshot_orders AS SELECT id, order_date, sales_rep_id FROM orders;
CREATE TABLE _bi_phase0_snapshot_fact   AS SELECT * FROM bi_sales_fact;

UPDATE orders SET order_date = (created_at AT TIME ZONE COALESCE(get_tenant_timezone(tenant_id),'America/Sao_Paulo'))::date
WHERE order_date IS NULL;

UPDATE orders o SET sales_rep_id = c.sales_rep_id
FROM companies c WHERE o.company_id = c.id
  AND o.sales_rep_id IS NULL AND c.sales_rep_id IS NOT NULL;
```

> **Limitação histórica documentada**: como não existe `order_sales_rep_history`, o backfill atribui o **vendedor atual** do cliente a pedidos antigos. Pedidos cuja carteira mudou no passado serão atribuídos ao titular atual. Aceitável nesta fase. Registrado em `.lovable/memory/features/bi-phase0-historical-attribution.md` (será criado).

#### Frente C — Reprocesso completo do fact-table
Drain manual da fila + garantia de cobertura:
```sql
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT DISTINCT order_id FROM bi_sales_fact_queue LOOP
    BEGIN PERFORM refresh_bi_sales_fact(r.order_id);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
  FOR r IN SELECT id FROM orders WHERE id NOT IN (SELECT DISTINCT order_id FROM bi_sales_fact) LOOP
    BEGIN PERFORM refresh_bi_sales_fact(r.id);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
  DELETE FROM bi_sales_fact_queue;
END $$;
```

#### Frente D — Drainer permanente (Opção A escolhida) ✅ novo escopo

**D.1 — Função `process_bi_sales_fact_queue(p_limit int default 200)` (SECURITY DEFINER):**
- Lê IDs distintos da fila (`SELECT DISTINCT order_id ... LIMIT p_limit FOR UPDATE SKIP LOCKED` via CTE com `id` da fila).
- Para cada `order_id`: chama `refresh_bi_sales_fact(order_id)` dentro de `BEGIN/EXCEPTION`.
- Em sucesso → deleta as linhas correspondentes da fila.
- Em erro → marca a linha com `error = SQLERRM, attempts = attempts+1, last_attempt_at = now()` (requer 3 novas colunas em `bi_sales_fact_queue`).
- Retorna `jsonb` com `{processed, failed, remaining}` para observabilidade.

**D.2 — Schema de `bi_sales_fact_queue`** (ALTER TABLE):
```sql
ALTER TABLE bi_sales_fact_queue
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;
-- Linhas com attempts >= 5 são ignoradas pelo drainer (poison pill) e listadas em diagnóstico.
```

**D.3 — Agendamento (`pg_cron` + `pg_net`)** — via `supabase--insert` (não migration, contém ref do projeto):
```sql
SELECT cron.schedule(
  'bi-sales-fact-drainer',
  '*/2 * * * *',
  $$ SELECT public.process_bi_sales_fact_queue(500); $$
);
```
- Roda a cada 2 min. Custo desprezível (DELETE+INSERT por `order_id`, escopo pequeno).
- Idempotente. Se `pg_cron` não existir, instalamos: `CREATE EXTENSION IF NOT EXISTS pg_cron;` na própria migration.

> **Por que não Opção B**: o trigger AFTER chamando `refresh_bi_sales_fact` síncrono no commit do pedido cria risco real de lock em UPDATE em cascata de `order_items` (200+ inserts por proposta aprovada). Assíncrono é mais seguro e já está parcialmente modelado pela fila.

---

### 3. Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<nova>.sql` | Snapshot + trigger A + backfill B + reprocesso C + colunas/função D.1/D.2 + `CREATE EXTENSION pg_cron` |
| `supabase--insert` (separado) | `cron.schedule(...)` para o drainer |
| `.lovable/memory/features/bi-phase0-historical-attribution.md` | Limitação documentada |
| `.lovable/plan.md` | Atualizado com Fase 0 → 1 |
| **Nada** em frontend, RPCs `report_*`, edge functions ou `refresh_bi_sales_fact` |

---

### 4. Queries de validação (relatório final da Fase 0)

```sql
-- 4.1 Antes vs depois — pedidos
SELECT
  count(*) total_pedidos,
  count(*) FILTER (WHERE order_date IS NULL) sem_order_date,
  count(*) FILTER (WHERE sales_rep_id IS NULL) sem_vendedor,
  count(*) FILTER (WHERE legal_entity_id IS NULL) sem_entidade
FROM orders;

-- 4.2 Critério revisado: pedidos sem vendedor MAS com cliente que tem vendedor cadastrado
-- (esses são bugs reais; demais são lacuna cadastral de carteira)
SELECT o.id, o.company_id, c.name AS cliente, c.sales_rep_id AS rep_no_cliente
FROM orders o JOIN companies c ON c.id = o.company_id
WHERE o.sales_rep_id IS NULL AND c.sales_rep_id IS NOT NULL;
-- ACEITE: 0 linhas após backfill

-- 4.3 Clientes sem vendedor padrão (lacuna cadastral — não é bug do BI)
SELECT count(*) AS clientes_sem_vendedor
FROM companies WHERE sales_rep_id IS NULL;
-- INFORMATIVO: lista será entregue ao gestor para correção manual

-- 4.4 Pedidos que ficarão "Sem vendedor" nos relatórios
SELECT o.id, le.name AS entidade, o.created_at::date
FROM orders o
LEFT JOIN legal_entities le ON le.id = o.legal_entity_id
WHERE o.sales_rep_id IS NULL ORDER BY o.created_at DESC;

-- 4.5 Fact alinhado a orders
SELECT
  (SELECT count(*) FROM orders) AS pedidos,
  (SELECT count(DISTINCT order_id) FROM bi_sales_fact) AS no_fact,
  (SELECT count(*) FROM orders o WHERE NOT EXISTS (SELECT 1 FROM bi_sales_fact b WHERE b.order_id=o.id)
     AND EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=o.id)) AS faltantes_com_itens;
-- ACEITE: faltantes_com_itens = 0

-- 4.6 Consistência financeira (tolerância arredondamento)
SELECT
  ROUND((SELECT SUM(COALESCE(subtotal_item, subtotal, quantity*unit_price)) FROM order_items oi
         WHERE EXISTS (SELECT 1 FROM orders o WHERE o.id=oi.order_id)),2) AS total_items,
  ROUND((SELECT SUM(net_value) FROM bi_sales_fact),2) AS total_fact;

-- 4.7 Cobertura por entidade jurídica
SELECT le.name, count(DISTINCT bsf.order_id) pedidos, ROUND(SUM(bsf.net_value),2) valor
FROM bi_sales_fact bsf JOIN legal_entities le ON le.id = bsf.legal_entity_id
GROUP BY le.name ORDER BY valor DESC;

-- 4.8 Fila e drainer
SELECT count(*) FROM bi_sales_fact_queue;                       -- ACEITE pós-drain: 0 (ou só poison pills)
SELECT process_bi_sales_fact_queue(500);                        -- {processed, failed, remaining}
SELECT count(*) FILTER (WHERE attempts >= 5) AS poison FROM bi_sales_fact_queue;

-- 4.9 RPCs reais — respeitam permissões via bi_is_admin_or_dev / bi_my_sales_rep_id
SELECT report_dashboard_executivo(jsonb_build_object(
  'start_date', (CURRENT_DATE - 365)::text, 'end_date', CURRENT_DATE::text));
-- ACEITE: kpis.qtd_pedidos > 0, top_vendedores não vazio, evolucao com >= 1 ponto

SELECT report_vendas_vendedor(jsonb_build_object(
  'start_date', (CURRENT_DATE - 365)::text, 'end_date', CURRENT_DATE::text));
-- ACEITE: retorna ao menos 1 vendedor com total > 0

-- 4.10 Empresa Ativa como filtro padrão (validação manual no app)
-- Logar com usuário admin com Martina ativa → abrir Dashboard Executivo
-- → confirmar que filtro de entidade vem pré-selecionado com Martina
-- (Fase 1 — a UI será ajustada lá; aqui só validamos que a RPC já aceita legal_entity_id)
```

---

### 5. Critérios de aceite (gate para Fase 1)

- [ ] Query 4.2 retorna **0 linhas**.
- [ ] Query 4.5 → `faltantes_com_itens = 0`.
- [ ] Query 4.6 → diferença ≤ R$ 1,00 (arredondamento por item).
- [ ] Query 4.8 → fila zerada (ou só poison pills documentadas).
- [ ] Query 4.9 → dashboard executivo retorna dados não-vazios para últimos 12 meses.
- [ ] **Teste E2E**: criar 1 pedido novo na UI → `orders.order_date` e `orders.sales_rep_id` preenchidos automaticamente; `bi_sales_fact` recebe a linha em ≤ 2 min via cron.
- [ ] **Não-regressão**: Dashboard Executivo, Conversão, Vendas por Vendedor, Metas — todos abrem sem erro e mostram dados (≥ os de hoje).
- [ ] Snapshots `_bi_phase0_snapshot_*` criados.
- [ ] `pg_cron` agendado e visível em `cron.job`.

---

### 6. Relatório de validação entregue ao final

Bloco único em markdown contendo:

| Métrica | Antes | Depois |
|---|---|---|
| Pedidos totais | 164 | ? |
| Pedidos sem `order_date` | 164 | **0** esperado |
| Pedidos sem `sales_rep_id` com cliente válido | ? | **0** esperado |
| Clientes sem vendedor padrão | ? (informativo) | ? |
| Linhas em `bi_sales_fact` | 194 | ≥ 194 |
| Fila `bi_sales_fact_queue` | 943 | 0 (ou poison) |
| Cobertura por entidade | — | tabela 4.7 |
| `report_dashboard_executivo` (12m) | vazio | ✅ com dados |
| `report_vendas_vendedor` (12m) | vazio | ✅ com dados |
| Pedido teste pós-deploy | — | ✅ campos preenchidos automaticamente |

Lista anexa: pedidos órfãos (4.4) e clientes sem vendedor (4.3) → ação cadastral do gestor.

---

### 7. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Backfill atribui vendedor errado a pedido antigo | Documentado como limitação; usuário pode corrigir manualmente — mesma regra que `useSalesGoals` já aplica hoje |
| Trigger BEFORE quebrar inserts | Só preenche quando NULL; testado por inserção controlada |
| Drainer concorrente com chamadas síncronas | `refresh_bi_sales_fact` é idempotente (DELETE+INSERT por order_id) |
| Poison pill enche a fila | `attempts >= 5` ignorado; query 4.8 destaca |
| `pg_cron` indisponível no plano atual | Verificado durante migration; se falhar, drainer fica como RPC manual e marcamos task de upgrade |
| RLS bloqueando função | `process_bi_sales_fact_queue` é SECURITY DEFINER e `refresh_bi_sales_fact` já é DEFINER |

---

### 8. Rollback

```sql
-- Schema
SELECT cron.unschedule('bi-sales-fact-drainer');
DROP FUNCTION IF EXISTS process_bi_sales_fact_queue(int);
DROP TRIGGER IF EXISTS trg_orders_set_defaults ON orders;
DROP FUNCTION IF EXISTS set_order_defaults();
ALTER TABLE bi_sales_fact_queue DROP COLUMN attempts, DROP COLUMN last_attempt_at, DROP COLUMN last_error;

-- Dados
UPDATE orders o SET order_date = s.order_date, sales_rep_id = s.sales_rep_id
FROM _bi_phase0_snapshot_orders s WHERE o.id = s.id;
TRUNCATE bi_sales_fact;
INSERT INTO bi_sales_fact SELECT * FROM _bi_phase0_snapshot_fact;
```
Snapshots ficam por 30 dias; migration de limpeza posterior.

---

### 9. Fora de escopo (vai para Fase 1)

- Novos relatórios executivo e 360° do vendedor.
- `CompositeReportRenderer`.
- Ajuste de UI para usar `effectiveEntityId` como filtro default (RPC já aceita; é cosmético).
- Histórico de carteira por pedido (`order_sales_rep_history`) — feature nova, separada.

---

### 10. Sequência de execução

1. `supabase--migration` com Frentes A+B+C+D.1+D.2 e snapshot.
2. `supabase--insert` agendando o cron (`cron.schedule`).
3. Rodar bloco de validação (seção 4) e gerar relatório (seção 6).
4. Eu te entrego o relatório e aguardo aprovação para Fase 1.
