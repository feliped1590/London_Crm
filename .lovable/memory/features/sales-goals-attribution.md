---
name: Sales Goals Attribution
description: Goals are measured by orders (pedidos), attributed by sales_rep, not by deal owner
type: feature
---

Progresso de meta (`useSalesGoals` → `sales_goal_progress`) é calculado a partir de **pedidos** (`orders`), não de deals.

Regras:
- Resolve `sales_rep_id` do usuário via `user_sales_reps`.
- Conta pedidos no período onde `orders.sales_rep_id` ∈ reps do usuário **OU** `companies.sales_rep_id` ∈ reps do usuário (fallback enquanto `orders.sales_rep_id` chega `NULL`).
- Exclui `status = 'cancelado'`.
- Filtro temporal por `created_at` entre `period_start` e `period_end 23:59:59`.

Motivo: pedidos colocados por usuários delegados (carteira gerida — ex.: Maria Antonia colocando pedido para cliente da Fernanda Massi) precisam contar para a meta do vendedor dono da carteira, não para quem operou o pedido.

`currentDeals` no widget representa a contagem de pedidos (label "Deals" mantida por compatibilidade visual).
