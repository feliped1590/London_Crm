# ADR 0002 — Governança Comercial (Comissão + Condições de Pagamento)

Status: Aprovado (Fase 1 — Modelagem)
Data: 2026-06-06
Relacionados: `.lovable/plan.md`, ADR 0001

## 1. Contexto

O CRM permite que vendedores negociem livremente comissão e condições de pagamento em pedidos/propostas. Não existe motor que (a) sugira valor padrão, (b) imponha teto configurável por hierarquia comercial, (c) registre exceções com aprovação rastreável.

Hoje há infraestrutura próxima reutilizável:
- `order_approvals` + `order_approval_rules` + `useOrderApproval` (fluxo de aprovação de pedidos).
- `usePriceAuthorization` (autorização pontual de preço fora de tabela).
- `order_payment_conditions` / `proposal_payment_conditions` (múltiplas parcelas por documento — ver memória `database/orders-payment-fields`).
- `payment_method_erp_mapping` (formas de pagamento já normalizadas por tenant).

## 2. Decisão

Criar módulo **Governança Comercial** com 2 motores:

1. **Comissão** — regra resolve `default_pct` e `max_pct` por hierarquia (vendedor × cliente × produto). Vendedor pode usar `[0 … max_pct]` livre. Acima de `max_pct` → snapshot marca `needs_approval=true`, pedido salva normalmente, transição de status fica gated.
2. **Condições de Pagamento** — regra resolve `default_template_id` e `max_template_rank` por hierarquia (cliente → grupo econômico → vendedor → geral, sempre combinada com faixa de valor). Template tem `rank` inteiro definido pelo admin; comparação é `escolhido.rank ≤ max_template_rank`. Acima → snapshot marca `needs_approval=true`.

Aprovação reaproveita o esqueleto de `order_approvals` via nova tabela `order_approval_requests` específica de governança comercial (mantém separação semântica e auditável).

## 3. Princípios

- **Save nunca bloqueia.** Pedido fica em `draft` com badges.
- **Bloqueio só na transição de status.** RPC dedicada decide: cria request (se flag ON) ou bloqueia transição (se flag OFF).
- **Snapshots imutáveis** por item (`order_item_commission_snapshot`) e por pedido (`order_payment_terms_snapshot`). Refletem o estado no momento da gravação — não recalculam.
- **Compatibilidade total com legado.** Pedidos sem regra cadastrada = comportamento atual. `orders.payment_terms`/`payment_method` continuam gravados para ERP (regra de `database/orders-payment-fields` permanece).
- **Multi-tenant** por `tenant_id` (sem FK — padrão do projeto).
- **Multi-entity opcional.** Regras herdam visibilidade do tenant; se necessário, fase futura adiciona escopo por `legal_entity_id` (não nesta entrega).

## 4. Hierarquia de Resolução

### Comissão (mais específico vence)
1. vendedor + cliente + produto
2. vendedor + produto
3. cliente + produto
4. vendedor + grupo econômico
5. vendedor
6. cliente (ou grupo econômico)
7. produto / subgrupo / grupo
8. geral do tenant

`resolve_commission_rule(sales_rep, company, product, date)` retorna a primeira regra ativa ordenada por `priority DESC, valid_from DESC`.

### Condições de Pagamento (nível + faixa de valor)
| Nível | Critério |
|---|---|
| 1 | `company_id` + faixa |
| 2 | `economic_group_id` + faixa |
| 3 | `sales_rep_id` + faixa |
| 4 | regra geral + faixa |

`resolve_payment_terms_rule(company, sales_rep, order_amount, date)` → `ORDER BY level ASC, priority DESC, valid_from DESC LIMIT 1`.

## 5. Rank de Templates

Cada `payment_terms_templates` recebe `rank INT` definido pelo admin. Templates não-padrão (ex.: `30/60/90`) podem ser equiparados a padrões (`28/35/42` = rank 3). Validação = comparação inteira. Não exige UNIQUE em `rank` (admin pode empatar).

## 6. Flags por Tenant

`tenant_settings`:
- `commission_allow_exception BOOL DEFAULT true`
- `payment_terms_allow_exception BOOL DEFAULT true`

ON → exceção cria `approval_request` na transição. OFF → transição bloqueada.

## 7. Tabelas (resumo executivo)

| Tabela | Propósito | RLS |
|---|---|---|
| `commission_rules` | Regras de comissão por hierarquia | Read tenant; Write admin/dev |
| `payment_terms_templates` | Templates nomeados com `rank` | Read tenant; Write admin/dev |
| `payment_terms_template_items` | Parcelas do template | Idem template |
| `payment_terms_rules` | Resolução por nível + faixa | Read tenant; Write admin/dev |
| `order_item_commission_snapshot` | Snapshot imutável por item | Read tenant; Write trigger/service |
| `order_payment_terms_snapshot` | Snapshot imutável por pedido | Read tenant; Write trigger/service |
| `order_approval_requests` | Solicitações de exceção | Read tenant (criador/admin); Write criador (insert) + admin (review) |

Detalhamento completo de colunas em `.lovable/plan.md` §5.

## 8. RPCs

- `resolve_commission_rule(_sales_rep uuid, _company uuid, _product uuid, _at date) → record`
- `resolve_payment_terms_rule(_company uuid, _sales_rep uuid, _amount numeric, _at date) → record`
- `create_commercial_approval_request(_order uuid, _item uuid, _type text, _justification text) → uuid`
- `review_commercial_approval_request(_id uuid, _decision text, _notes text) → void`
- `validate_order_status_transition(_order uuid, _next_status text) → jsonb` (extensão da lógica atual — checa pendências de governança antes de permitir).

Todas `SECURITY DEFINER`, `SET search_path = public`.

## 9. Triggers

- `AFTER INSERT/UPDATE ON order_items` → recalcula snapshot de comissão. Sem bloqueio.
- `AFTER UPDATE ON orders` (quando `total_amount` muda) → recalcula snapshot de pagamento. Sem bloqueio.
- Bloqueio fica em `validate_order_status_transition`, chamada explicitamente pelo front antes de mudar `status`.

## 10. Frontend

Página `Settings → Governança Comercial` com 5 abas:
1. Regras de Comissão (CRUD + preview de resolução)
2. Templates de Pagamento (CRUD + edição de `rank`)
3. Regras de Pagamento (CRUD por nível)
4. Configurações (flags `allow_exception` por tipo)
5. Solicitações Pendentes (fila de aprovação)

Integrações:
- `OrderItemDetailModal` — preenche `default_pct`, badge se `applied_pct > max_pct`.
- `PaymentConditionsEditor` — filtra templates por `rank ≤ max_template_rank`; permite escolher acima com badge.
- `OrderDialog` — header consolida pendências; botão "Avançar" chama `validate_order_status_transition`.
- Componente compartilhado `<NeedsApprovalBadge />`.

Sem alteração em `order-mapper.ts` (ERP) — snapshot é interno; ERP continua recebendo `orders.payment_method` / `payment_terms` legados.

## 11. Riscos & Mitigação

| Risco | Mitigação |
|---|---|
| Pedidos legados sem regra → não devem quebrar | `resolve_*` retorna `NULL` → snapshot não é gravado → comportamento atual preservado |
| Performance de resolução em listagens | Resolver só on save/edit; snapshots servem leituras |
| Admin esquece de cadastrar template `default` | Validação na criação da regra: `default_template_id NOT NULL` e `rank ≤ max_template_rank` |
| Mudança retroativa de regra afeta pedido fechado | Snapshot é imutável; novas regras só impactam novos saves |
| Aprovação contornada via update direto no DB | Snapshot tem `needs_approval`; trigger só limpa via RPC `review_commercial_approval_request` |
| Conflito com `order_approvals` existente | Tabelas separadas (`order_approval_requests`) com prefixo `commercial`; status próprio `pending_commercial_approval` |

## 12. Fora de Escopo

- Cálculo de comissão a pagar (folha/financeiro)
- Split entre múltiplos vendedores
- Notificação push/email (futuro)
- Escopo por `legal_entity_id` em regras (futuro)
- Migração de pedidos antigos para preencher snapshots

## 13. Métricas de Sucesso

- 100% dos pedidos novos com regra aplicável têm snapshot.
- 0 transições de status com `needs_approval=true` sem `approval_request` correspondente.
- Tempo médio de aprovação rastreável via `requested_at` → `reviewed_at`.

## 14. Próximas Fases

Conforme `.lovable/plan.md` §9 — Fase 2 inicia migrations.
