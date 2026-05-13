---
name: Orders Payment Fields
description: Multi-form payment conditions per order/proposal via dedicated tables; legacy text fields kept as fallback for ERP sync
type: feature
---

## Estrutura

Pedidos e Propostas suportam **múltiplas formas de pagamento por documento** (ex.: R$ 5.000 antecipado + saldo em boleto 28/35).

Tabelas dedicadas:
- `order_payment_conditions` — uma linha por parcela do pedido
- `proposal_payment_conditions` — uma linha por parcela da proposta

Colunas principais: `parcela`, `dias`, `payment_method` (texto = `crm_payment_method` da `payment_method_erp_mapping`), `tipo` (`'V'` valor fixo / `'P'` percentual), `valor` (R$ quando `V`), `percentual` (% opcional quando `P`; null = rateio igual do saldo).

## Compatibilidade legada (fallback)

Os campos `orders.payment_method` e `orders.payment_terms` (idem em `proposals`) **continuam existindo e são gravados** com base na 1ª condição + dias concatenados (`28/35/42`). Isso garante que pedidos antigos e o sync ERP atual (`order-loader.ts` → `parsePaymentTerms`) continuem funcionando sem migração de dados.

Pedidos antigos NÃO foram migrados (decisão do usuário). Eles seguem usando apenas os campos legados.

## Frontend

- Componente compartilhado `src/components/orders/PaymentConditionsEditor.tsx` (usado em Pedidos e Propostas).
- Hook `src/hooks/usePaymentConditions.ts` faz load/persist (delete + insert).
- Atalhos: "À vista", "Parcelado simples", "Entrada + parcelas".
- Validação no submit (`validatePaymentConditions`) bloqueia salvar se a soma não fechar 100% do total.

## Regras

- `tipo='V'` → `valor` obrigatório; soma dos `V` ≤ total do pedido.
- `tipo='P'` com `percentual` → todas as `P` devem ter percentual e somar 100% do saldo.
- `tipo='P'` sem `percentual` → rateio igual automático do saldo restante.
- `payment_method` por linha permite mix (ex.: parcela 1 = Antecipado, parcelas 2-3 = Boleto).

## Pendente (próxima rodada)

- `order-loader.ts` ler de `order_payment_conditions` (hoje só usa fallback legado).
- `order-mapper.ts` enviar `valor` em `pagto[]` quando `tipo='V'`.
- `proposal-approve` copiar `proposal_payment_conditions` → `order_payment_conditions` ao gerar pedido.
