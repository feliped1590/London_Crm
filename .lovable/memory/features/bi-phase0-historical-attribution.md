---
name: BI Phase 0 — Atribuição Histórica de Vendedor
description: Backfill de orders.sales_rep_id usa o vendedor atual do cliente; não existe histórico de carteira por pedido
type: constraint
---

Na Fase 0 da Central de BI, o backfill de `orders.sales_rep_id` (pedidos antigos sem vendedor) foi feito copiando `companies.sales_rep_id` atual. Como não existe `order_sales_rep_history`, **pedidos cuja carteira mudou no passado serão atribuídos ao vendedor atual do cliente**. Aceitável para os relatórios executivos da Fase 1.

A partir desta migration:
- Trigger `set_order_defaults` (BEFORE INSERT/UPDATE em `orders`) preenche `order_date` (com fuso do tenant) e `sales_rep_id` (a partir de `companies.sales_rep_id`) sempre que estiverem `NULL`. Nunca sobrescreve valor explícito.
- Drainer `process_bi_sales_fact_queue(limit)` roda a cada 2 min via `pg_cron` (jobname `bi-sales-fact-drainer`) e mantém `bi_sales_fact` atualizado. Erros marcam `attempts/last_error`; `attempts >= 5` vira poison pill e é ignorada.
- Snapshots de rollback: `_bi_phase0_snapshot_orders` e `_bi_phase0_snapshot_fact` (RLS ON, sem policies — só service_role).

**Why:** evitar promessa de séries históricas "exatas" por vendedor antes da CRM go-live e manter a Fase 1 reusando RPCs `report_*` sem mudanças.
