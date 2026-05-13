# Múltiplas formas de pagamento por pedido

Suportar mistura de formas/parcelas (ex.: R$ 5.000 antecipado + saldo em boleto 28/35) em Pedidos, Propostas e Documentos, com sync correto para o ERP.

## Banco

Nova tabela `order_payment_conditions`:
- `id`, `tenant_id`, `order_id` (FK), `parcela` (int), `dias` (int, ≥0)
- `forma_recebimento_id` (FK para tabela de formas de recebimento, com `erp_code`)
- `tipo` (`'V'` | `'P'`)
- `valor` (numeric, nullable — usado quando `tipo='V'`)
- `percentual` (numeric, nullable — usado quando `tipo='P'`)
- `created_at`, `updated_at`
- Unique `(order_id, parcela)`
- RLS por `tenant_id` + acesso herdado do pedido

Tabelas espelho: `proposal_payment_conditions` e `document_payment_conditions` com mesma estrutura, FK para `proposals.id` e `documents.id`.

Pedidos antigos: **não** mexer. Continuam lendo `orders.payment_method` + `payment_terms` (fallback no mapper).

## Backend / Sync ERP

`supabase/functions/_shared/projedata/order-types.ts`:
- Adicionar `valor?: number` em `ProjedataOrderPayment`.

`supabase/functions/_shared/projedata/order-mapper.ts`:
- Se houver linhas em `order_payment_conditions` → mapeia 1:1 (incluindo `valor` quando `tipo='V'`).
- Se não houver (pedido legado) → mantém `parsePaymentTerms` atual.

`supabase/functions/validate-order-sync/index.ts`:
- Validar que toda parcela tem `forma_recebimento` mapeada (`erp_code`).
- Validar que soma de `V` ≤ total do pedido.
- Validar que percentuais somam exatamente 100% do saldo restante (após subtrair os `V`).
- Bloqueia sync com `blocked_validation` se inválido.

## Frontend — Editor de Parcelas

Componente novo `src/components/orders/PaymentConditionsEditor.tsx`, reutilizado em Pedidos, Propostas e Documentos.

Layout (tabela editável):

```text
| # | Dias | Tipo | Valor / %        | Forma de Recebimento | [x] |
| 1 |   0  |  R$  | R$ 5.000,00      | Antecipado           |  x  |
| 2 |  28  |  %   | 50%              | Boleto               |  x  |
| 3 |  35  |  %   | 50%              | Boleto               |  x  |
[+ Adicionar parcela]

Total alocado: R$ 12.500,00 de R$ 12.500,00 ✓
```

Comportamento:
- Toggle **R$ / %** por linha define o `tipo` (`V` / `P`). Default = `%`.
- Digitar no campo de R$ marca automaticamente `tipo='V'`; digitar no de % marca `tipo='P'`.
- Rateio automático: se houver linhas `V` e demais em branco/`P`, distribui igualmente o saldo restante em % entre as `P`.
- Resumo ao vivo do total alocado vs total do pedido. Bloqueia salvar se não fechar 100%.
- Atalhos no topo:
  - **À vista** → 1 parcela, 0 dias, 100%
  - **Parcelado simples** → input `28/35/42` + 1 forma → gera N parcelas iguais em `P` (mantém o fluxo atual rápido)
  - **Entrada + parcelas** → input do valor da entrada + dias das demais → gera 1 linha `V` (0 dias) + N linhas `P`

Substitui os 2 campos atuais (`Forma de Pagamento` + `Condições (dias)`) em:
- `OrderForm` (Pedidos)
- `ProposalDialog` (Propostas)
- `DocumentLogisticsSection` ou equivalente (Documentos)

Aprovação pública de proposta (`proposal-approve`) já gera Pedido herdando dados — vai herdar também as parcelas (copia `proposal_payment_conditions` → `order_payment_conditions`).

## Arquivos previstos

**Banco (migration):**
- `order_payment_conditions`, `proposal_payment_conditions`, `document_payment_conditions` + RLS + índices

**Backend:**
- `supabase/functions/_shared/projedata/order-types.ts` — `valor?` em `ProjedataOrderPayment`
- `supabase/functions/_shared/projedata/order-mapper.ts` — leitura das condições novas + fallback legado
- `supabase/functions/_shared/projedata/order-loader.ts` — JOIN com `order_payment_conditions`
- `supabase/functions/validate-order-sync/index.ts` — novas validações
- `supabase/functions/proposal-approve/index.ts` — copiar parcelas da proposta para o pedido

**Frontend:**
- `src/components/orders/PaymentConditionsEditor.tsx` (novo, compartilhado)
- `src/components/orders/OrderForm.tsx` — substituir campos
- `src/components/proposals/ProposalDialog.tsx` — substituir campos
- `src/components/documents/DocumentLogisticsSection.tsx` — substituir campos
- `src/types/orders.ts` (e equivalentes) — tipo `PaymentCondition`
- Hooks de leitura/persistência das parcelas

## Memória do projeto

Atualizar `mem://database/orders-payment-fields` para refletir o novo modelo (tabela própria com mix V/P) e marcar `orders.payment_method` / `payment_terms` como legado/fallback.
