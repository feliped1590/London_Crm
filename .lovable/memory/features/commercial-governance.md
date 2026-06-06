---
name: Commercial Governance
description: Motor de governança comercial — comissão (default_pct/max_pct) e condições de pagamento (rank de templates) com aprovação por exceção sem travar save
type: feature
---

## Conceito

Dois motores complementares aplicados a Pedidos (e Propostas, fase futura):

1. **Comissão** — regra por hierarquia resolve `default_pct` + `max_pct`. Vendedor pode usar `[0…max_pct]` livre. Acima → snapshot grava `needs_approval=true`.
2. **Condições de Pagamento** — templates têm `rank INT` (admin define). Regra por nível+faixa de valor resolve `default_template_id` + `max_template_rank`. Validação = `escolhido.rank ≤ max_template_rank`.

## Princípios invioláveis

- **Save nunca bloqueia.** Pedido fica em `draft` com badge "Pendente aprovação".
- **Bloqueio só na transição de status** via `validate_order_status_transition`.
- **Snapshots imutáveis** — `order_item_commission_snapshot` e `order_payment_terms_snapshot` refletem o estado gravado; não recalculam.
- **Flags por tenant** (`tenant_settings.commission_allow_exception`, `payment_terms_allow_exception`): ON cria `order_approval_requests`; OFF bloqueia transição.
- **Legado preservado.** Pedidos sem regra aplicável = comportamento atual. `orders.payment_terms`/`payment_method` continuam gravados para ERP (sem mudança em `order-mapper.ts`).

## Hierarquia comissão (mais específico vence)
vendedor+cliente+produto → vendedor+produto → cliente+produto → vendedor+grupo → vendedor → cliente/grupo → produto/subgrupo/grupo → geral.

## Hierarquia pagamento (nível + faixa de valor obrigatória)
1=cliente, 2=grupo econômico, 3=vendedor, 4=geral. `ORDER BY level ASC, priority DESC LIMIT 1`.

## Aprovação

Tabela `order_approval_requests` (separada de `order_approvals` legada). Status do pedido em revisão = `pending_commercial_approval`. Aprovação devolve ao fluxo original; rejeição retorna a `draft`.

## Não fazer

- Não recalcular snapshot retroativamente quando regra muda.
- Não bloquear `INSERT/UPDATE` de `order_items` por trigger.
- Não usar CHECK constraint para validar `rank` ou faixas (usar trigger).
- Não armazenar comissão calculada a pagar (fora de escopo — só governança).

## Referências

- ADR: `docs/02-decisions/0002-governanca-comercial.md`
- Plano: `.lovable/plan.md`
- Reuso: `useOrderApproval`, `usePriceAuthorization`, `PaymentConditionsEditor`, `payment_method_erp_mapping`.
