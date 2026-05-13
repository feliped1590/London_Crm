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

## Envio ao ERP (`pagto[]` em `IMP_PEDIDO_V3`)

- `tipo='V'` → enviar `fator` = valor em R$ (ex.: `1000` = R$ 1.000,00). Validador exige `fator > 0`.
- `tipo='P'` → **OMITIR o campo `fator`** do JSON. O ERP Projedata calcula o saldo automaticamente (rateio). Enviar `fator=0` dispara `ORA-20270` no trigger `TGI_FINVENCTOS` ("fator deve ser > 0 e ≤ 100" para tipo P).
- Implementação: `_shared/projedata/order-mapper.ts` só inclui `fator` quando `tipo === 'V'`. Tipo em `ProjedataOrderPayment.fator` é opcional (`fator?: number`).
