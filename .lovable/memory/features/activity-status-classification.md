---
name: Activity Status Classification
description: Eixo Ativo/Inativo/Perdido aplicado APENAS a clientes (customer_active); leads/prospects ficam fora desse eixo. Cards do dashboard mutuamente exclusivos somando 100%.
type: feature
---

## Regra

`activity_status` (enum: ativo, inativo, perdido) só é calculado para empresas com `lifecycle_stage = 'customer_active'`. Para lead/prospect fica `NULL`.

Thresholds (baseado em `company_activity_summary.last_interaction_at`):
- ativo: ≤ 6 meses
- inativo: entre 6 e 12 meses
- perdido: > 12 meses
- Sem interação real: usa `companies.created_at` como fallback no `recompute_company_lifecycle`

## Fonte de última interação

View `company_activity_summary.last_interaction_at` = GREATEST de: activities, tasks (created/completed), email_logs, whatsapp_messages outbound, deals, deal_stage_history, orders, proposals, entity_notes (company/contact/deal). **Não inclui mais `lifecycle_baseline_at`** — removido para evitar que todos apareçam como ativos artificialmente.

## Dashboard

Os 5 cards do LifecyclePanel são mutuamente exclusivos e somam 100%:
Leads + Prospects + Clientes Ativos + Clientes Inativos + Clientes Perdidos.

`get_activity_status_counts()` filtra por `lifecycle_stage = 'customer_active'`.

## Automação

- Cron diário 03:00 BRT roda `recompute_company_lifecycle(NULL)`.
- Triggers AFTER INSERT em orders, activities, entity_notes promovem cliente para ativo imediatamente (sem efeito em lead/prospect).
- Mudanças logadas em `company_audit_log` com `origem_alteracao = 'SYSTEM_LIFECYCLE'`.
