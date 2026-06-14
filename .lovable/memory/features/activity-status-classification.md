---
name: Activity Status Classification
description: Eixo Ativo/Inativo/Perdido aplicado APENAS a clientes (customer_active); thresholds vêm de lifecycle_config. Baseline universal 01/04/2026 substitui created_at como fallback de última interação.
type: feature
---

## Regra

`activity_status` (enum: ativo, inativo, perdido) só é calculado para `lifecycle_stage = 'customer_active'`. Lead/prospect ficam `NULL`.

Thresholds vêm de `lifecycle_config` (default 180/365 dias). Fallback quando não há interação real: `companies.lifecycle_baseline_at` (universalmente fixado em **2026-04-01** no saneamento de 14/06/2026). NÃO usa mais `created_at`.

## Saneamento 14/06/2026

Limpeza única aplicada na base:
- Customer Active sem pedido → rebaixado para Lead
- Prospect sem deal → rebaixado para Lead
- Lead com deal aberto em pipeline 'sales' → promovido para Prospect
- Lead/Prospect com pedido → promovido para Customer Active
- `lifecycle_baseline_at = 2026-04-01` em 100% das empresas

Resultado: customer_active = exatamente quem tem pedido.

## Dashboard

5 cards do LifecyclePanel mutuamente exclusivos: Leads + Prospects + Ativos + Inativos + Perdidos = 100%. `get_activity_status_counts()` filtra `lifecycle_stage = 'customer_active'`.

## Automação

- Cron diário recompute_company_lifecycle(NULL).
- Triggers AFTER INSERT em deals (lead→prospect) e orders (lead/prospect→customer_active).
- Mudanças logadas em `company_audit_log`.
