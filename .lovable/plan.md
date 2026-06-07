## Objetivo

1. Permitir **múltiplos vendedores** numa mesma regra (comissão e pagamento).
2. Permitir **vincular regra a uma ou mais entidades jurídicas** (obrigatório ≥1).

A regra continua única em `commission_rules` / `payment_terms_rules`. Vendedores e entidades viram **tabelas de vínculo (junctions)**, igual ao padrão já usado em `pipeline_legal_entities`.

## Modelagem (migration)

### Novas tabelas

```text
commission_rule_sales_reps           payment_terms_rule_sales_reps
 - rule_id (FK commission_rules)      - rule_id (FK payment_terms_rules)
 - sales_rep_id (FK sales_reps)       - sales_rep_id (FK sales_reps)
 - tenant_id                          - tenant_id
 PK (rule_id, sales_rep_id)           PK (rule_id, sales_rep_id)

commission_rule_legal_entities       payment_terms_rule_legal_entities
 - rule_id                            - rule_id
 - legal_entity_id (FK legal_entities)- legal_entity_id
 - tenant_id                          - tenant_id
 PK (rule_id, legal_entity_id)        PK (rule_id, legal_entity_id)
```

- RLS: read por tenant; write por `is_governance_admin`.
- GRANTs `authenticated` + `service_role`.

### Colunas legadas

- `commission_rules.sales_rep_id` e `payment_terms_rules.sales_rep_id` ficam **deprecated** (nullable). Resolver para de usá-las. UI deixa de gravá-las. Coluna mantida por compatibilidade/auditoria. Drop futuro.

### Backfill (idempotente, dentro da migration)

- Para cada regra existente com `sales_rep_id NOT NULL` → insere 1 linha na junction de vendedores.
- Para cada regra existente → insere N linhas na junction de entidades, **uma para cada `legal_entity` ativa do tenant da regra** (preserva comportamento atual de "vale para tudo").

### Integridade

- Trigger `BEFORE INSERT/UPDATE` em `commission_rules` e `payment_terms_rules`: se `is_active=true` exige ≥1 vínculo em entidades jurídicas (verifica via `EXISTS`).
- Validação **client-side** também exige ≥1 entidade antes de salvar (UX).
- Trigger em `*_rule_legal_entities` `BEFORE DELETE`: bloqueia se sobrar 0 vínculos para regra ativa.

## Resolvers

`resolve_commission_rule(_tenant, _sales_rep, _company, _product, _at, **_legal_entity uuid**)`
`resolve_payment_terms_rule(_tenant, _company, _sales_rep, _amount, _at, **_legal_entity uuid**)`

Adicionam:

```sql
AND EXISTS (
  SELECT 1 FROM commission_rule_legal_entities x
  WHERE x.rule_id = r.id AND x.legal_entity_id = _legal_entity
)
AND (
  NOT EXISTS (SELECT 1 FROM commission_rule_sales_reps s WHERE s.rule_id = r.id)
  OR EXISTS (SELECT 1 FROM commission_rule_sales_reps s
             WHERE s.rule_id = r.id AND s.sales_rep_id = _sales_rep)
)
```

Especificidade (CASE) substitui o peso de `sales_rep_id` por:
```
+ (CASE WHEN EXISTS (SELECT 1 FROM commission_rule_sales_reps WHERE rule_id = r.id) THEN 1 ELSE 0 END)
```

`_legal_entity` é **obrigatório** no resolver (sem default NULL).

## RPCs derivadas

Atualizar `create_commercial_approval_request` (em `20260606231630_*.sql` linhas 115 e 170) para resolver passando `orders.legal_entity_id`. Sem mudança de assinatura externa — o legal_entity vem do `orders` que já está em escopo.

## Frontend

### Hooks
- `useResolveCommissionRule` / `useResolvePaymentTermsRule` passam novo arg `legalEntityId` (já presente em `OrderDialog`/`OrderItemDetailModal` via `order.legal_entity_id`). Sem nova prop UX para o vendedor.

### CommissionRulesManager + PaymentRulesManager
- Substituir o `ComboSelect` único de vendedor por **multi-select de vendedores** (componente novo `_MultiComboSelect.tsx` baseado em `Command` + chips). Em payment, aparece só quando `level=3`.
- Adicionar **multi-select de entidades jurídicas** (obrigatório ≥1). Hint visual quando vazio + bloqueio do botão Salvar.
- Persistência: após `upsert` da regra, sincroniza as duas junctions (delete-then-insert no escopo do `rule_id`).
- Listagem: coluna "Entidades" mostra contagem (`3 entidades` com tooltip listando) e "Vendedores" mostra "Todos" / "N vendedores".
- Atalho **"Padrão por vendedor"** vira **multi-select pré-preenchido com 1 vendedor**, mas admin pode adicionar mais. Banner de cobertura considera a junction.

### Tipos
- `types.ts` é auto-gerado — sai pela migration.

## QA

- `scripts/qa/governance-multi-select.sql` cobrindo:
  - Regra com 2 vendedores resolve para os 2 e não para um terceiro.
  - Regra sem vínculo de vendedor (= todos) resolve para qualquer um.
  - Regra restrita a `legal_entity_id=A` não aparece para `B`.
  - Especificidade: regra `vendedor+produto` vence regra só `vendedor`.
  - Backfill: regras antigas resolvem para todas as entidades do tenant.

## Compatibilidade & Riscos

| Risco | Mitigação |
|---|---|
| Pedidos antigos sem `legal_entity_id` no contexto do resolver | Fallback: se `_legal_entity IS NULL`, ignora filtro de entidade (comportamento legado). |
| Regra ativa fica sem entidade após delete na junction | Trigger bloqueia. |
| Performance do EXISTS em listagens | Índices `(rule_id)` e `(legal_entity_id, rule_id)` nas junctions. |
| Duplicidade de regra "padrão por vendedor" agora pode coexistir em vários reps | Aviso UI continua válido por (rule_id, sales_rep_id). |

## Memória

Atualizar `mem://features/commercial-governance`:
- Vendedores via junction `commission_rule_sales_reps` / `payment_terms_rule_sales_reps`.
- Entidades jurídicas obrigatórias (≥1) via junction. Filtro no resolver.
- Coluna singular `sales_rep_id` deprecated.

## Entregáveis

1. **Migration única**: 4 junctions + GRANTs + RLS + triggers de integridade + backfill + alteração dos 2 resolvers.
2. `_MultiComboSelect.tsx` reutilizável.
3. `CommissionRulesManager.tsx` e `PaymentRulesManager.tsx` adaptados.
4. `useCommercialGovernance.ts`: persistência das junctions + nova assinatura dos resolvers.
5. `scripts/qa/governance-multi-select.sql`.
6. Memória atualizada.

Sem alteração em ERP, snapshots ou fluxo de aprovação.