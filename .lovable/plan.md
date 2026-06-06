# Governança Comercial — Plano Revisado

> **Fase 1 concluída** ✅ — ADR `docs/02-decisions/0002-governanca-comercial.md` + memória `mem://features/commercial-governance` publicados. Próxima: **Fase 2 — Migrations**.

---

## Ajustes aplicados nesta revisão

1. **Removido `min_pct`** da regra de comissão. Vendedor sempre pode reduzir até 0%. Mantidos apenas `default_pct` e `max_pct`.
2. **Hierarquia formal** de condições de pagamento detalhada (Seção 3).
3. **Exceção sem travar o pedido**: pedido continua sendo salvo em `draft`; só não pode avançar para o próximo status até a aprovação. Sem bloqueio em tela.
4. **Flag global** `allow_exception_request` por tipo de regra (comissão / pagamento) — admin liga/desliga em **Settings → Governança Comercial → Configurações**.
5. **Validação de templates por nível hierárquico** (rank inteiro) em vez de comparação estrutural parcela-a-parcela.

---

## 1. Regra de Comissão (ajustada)

`commission_rules`:
- `default_pct` — preenchido automaticamente.
- `max_pct` — teto.
- Vendedor pode usar `[0% … max_pct]` livremente.
- Acima de `max_pct`: campo aceita o valor, marca o item como **"Pendente Aprovação"** (badge laranja), pedido salva normalmente em `draft`. Não pode mudar para o próximo status sem resolver.

## 2. Solicitação de Exceção (sem travar)

Fluxo novo:

```
Vendedor digita comissão 6% (max=5%)
        │
        ▼
Item salvo com applied_pct=6 + needs_approval=true
        │
        ▼
Pedido permanece em DRAFT (salva sem bloquear)
        │
        ▼
Badge "Pendente aprovação" no item + no header do pedido
        │
        ▼
Ao tentar avançar status (ex.: enviar para aprovação) →
   se houver itens needs_approval=true E flag allow_exception_request=true:
      → cria order_approval_request automaticamente
      → status do pedido = 'pending_commercial_approval'
   se flag=false:
      → toast: "Limite excedido. Ajuste para prosseguir."
      → impede só a transição de status, não o save.
```

**Flag por tenant** (`tenant_settings`):
- `commission_allow_exception` (bool)
- `payment_terms_allow_exception` (bool)

## 3. Hierarquia de Condições de Pagamento (formal)

Resolução por **prioridade absoluta** (primeira regra encontrada vence; faixa de valor sempre obrigatória):

| Nível | Critério | Match Required |
|---|---|---|
| 1 | Cliente específico **+** faixa de valor | `company_id` + `amount` ∈ [`amount_min`, `amount_max`] |
| 2 | Grupo Econômico **+** faixa de valor | `economic_group_id` + faixa |
| 3 | Vendedor **+** faixa de valor | `sales_rep_id` + faixa |
| 4 | Regra Geral **+** faixa de valor | faixa apenas |

Resolver = `ORDER BY level ASC, priority DESC, valid_from DESC LIMIT 1`.

Cada regra aponta para:
- `default_template_id`
- `max_template_rank` (int) — usado pelo motor de comparação.

## 4. Comparação por Rank (substitui comparação estrutural)

Em vez de comparar parcelas, cada template recebe um **`rank` inteiro** definido pelo admin no cadastro:

| Template | Rank |
|---|---|
| À vista | 0 |
| 28 | 1 |
| 28/35 | 2 |
| 28/35/42 | 3 |
| 28/35/42/49 | 4 |
| 30/60/90 | 3 |

Regra de validação: `template_escolhido.rank ≤ regra.max_template_rank` → permitido.

Vantagens:
- Lógica de validação trivial (`<=` em inteiro).
- Admin pode equiparar templates não-padrão (ex.: `30/60/90` no mesmo rank de `28/35/42`).
- Permite criar novos templates futuramente sem rescrever motor.

`payment_terms_templates` ganha coluna `rank INT NOT NULL` (UNIQUE por `tenant_id`+`rank` não — pode haver empate).

## 5. Tabelas Finais

### `commission_rules`
```
id, tenant_id, name, is_active, priority, valid_from, valid_until,
sales_rep_id?, company_id?, economic_group_id?,
product_id?, product_group_id?, product_subgroup_id?,
base ('liquido'|'bruto'), default_pct, max_pct,
created_by, created_at, updated_at
```

### `payment_terms_templates`
```
id, tenant_id, name, rank, is_active, valid_from, valid_until, created_by
```

### `payment_terms_template_items`
```
id, template_id, parcela, dias, payment_method_default, tipo, percentual
```

### `payment_terms_rules`
```
id, tenant_id, name, level (1|2|3|4), priority, is_active,
valid_from, valid_until,
amount_min, amount_max,
company_id?, economic_group_id?, sales_rep_id?,
default_template_id, max_template_rank,
created_by
```

### `order_item_commission_snapshot` (imutável)
```
id, order_item_id, rule_id, default_pct, max_pct,
applied_pct, base_value, commission_value,
needs_approval (bool), approval_request_id?, created_at
```

### `order_payment_terms_snapshot` (imutável)
```
id, order_id, rule_id, default_template_id, max_template_rank,
applied_template_id, applied_rank,
needs_approval (bool), approval_request_id?, created_at
```

### `order_approval_requests`
```
id, tenant_id, order_id, order_item_id?,
request_type ('commission'|'payment_terms'),
requested_by, requested_at, justification,
requested_value (jsonb), max_allowed (jsonb), rule_id,
status ('pending'|'approved'|'rejected'),
reviewed_by?, reviewed_at?, review_notes?, approved_value (jsonb)?
```

### `tenant_settings` (campos novos)
```
commission_allow_exception bool default true,
payment_terms_allow_exception bool default true
```

---

## 6. Backend (resumo)

- `resolve_commission_rule(sales_rep, company, product, date)` → `{rule_id, default_pct, max_pct}`
- `resolve_payment_terms_rule(company, sales_rep, order_amount, date)` → `{rule_id, default_template_id, max_template_rank}`
- `create_approval_request(...)` — chamada na transição de status, não no save.
- `review_approval_request(id, decision, notes)` — admin.
- Trigger snapshot em `order_items` (AFTER) — grava `needs_approval` se exceder.
- Trigger snapshot em `orders` (AFTER) — grava condição aplicada.
- **Sem trigger de bloqueio** — bloqueio só na transição de status (RPC dedicada).

## 7. Frontend (resumo)

- Página nova: `Settings → Governança Comercial` com abas: **Regras de Comissão**, **Templates de Pagamento**, **Regras de Pagamento**, **Configurações** (flags), **Solicitações Pendentes**.
- `OrderItemDetailModal`: preenche `default_pct`, badge laranja se exceder `max_pct`.
- `PaymentConditionsEditor`: filtro de templates por `rank ≤ max_template_rank`; permite escolher acima → badge laranja.
- `OrderDialog`: header mostra "X itens / condição pendente aprovação"; botão de avançar status dispara `create_approval_request` quando aplicável.
- Componente `<NeedsApprovalBadge />` reutilizável.

## 8. Fluxo de Aprovação (revisado)

```
SAVE PEDIDO ─────────► sempre permitido (draft)
                       snapshots gravam needs_approval

AVANÇAR STATUS ──────► RPC valida pendências:
  ├─ nenhuma pendência: avança normal
  ├─ pendência + flag ON:  cria approval_request + status='pending_commercial_approval'
  └─ pendência + flag OFF: bloqueia transição com mensagem

APROVAR (admin) ─────► status volta p/ próximo passo do fluxo original
REJEITAR (admin) ────► status volta p/ 'draft', vendedor ajusta
```

Auditoria: `order_approval_requests` (append-only) + snapshots imutáveis + `order_audit_log`.

---

## 9. Fases (atualizadas)

| Fase | Objetivo | Complexidade |
|---|---|---|
| **1** | Modelagem detalhada + ADR + memory | Baixa |
| **2** | Migrations (tabelas, RLS, GRANTs, triggers de snapshot, flags em `tenant_settings`) | Alta |
| **3** | RPCs `resolve_*`, `create_approval_request`, `review_approval_request` | Alta |
| **4** | Página Governança Comercial (CRUD + flags) | Média |
| **5** | Integração OrderItemDetailModal, PaymentConditionsEditor, OrderDialog (badges + RPC na transição) | Alta |
| **6** | Solicitações Pendentes + extensão do `OrderApprovalTimeline` + testes QA | Média |

Compatibilidade: pedidos antigos sem regra cadastrada = comportamento atual (sem bloqueio, sem badges). `orders.payment_terms`/`payment_method` legados continuam sendo gravados para ERP — sem mudança em `order-mapper.ts`.

---

> Pronto para iniciar **Fase 1 — Modelagem detalhada + ADR**.
