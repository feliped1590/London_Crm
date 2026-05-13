## Diagnóstico

No pedido `PED-2026-0072` o CRM tem 5 parcelas em `order_payment_conditions`:

| # | dias | método      | tipo | valor   |
|---|------|-------------|------|---------|
| 1 | 0    | dinheiro    | V    | 1000,00 |
| 2 | 0    | dinheiro    | V    | 2000,00 |
| 3 | 0    | antecipado  | V    | 5000,00 |
| 4 | 0    | ted         | V    | 3000,00 |
| 5 | 28   | boleto      | P    | -       |

Mas o ERP recebeu apenas **1 parcela: 28 dias / DINHEIRO**.

**Causa:** `supabase/functions/_shared/projedata/order-loader.ts` ignora a tabela `order_payment_conditions` e usa só os campos legados `orders.payment_terms` ("0/0/0/0/28") + `orders.payment_method` ("dinheiro"). A função `parsePaymentTerms` (em `order-mapper.ts`) descarta `dias <= 0`, sobrando apenas a parcela "28", e aplica a forma de recebimento do cabeçalho a todas — perdendo o método por parcela e o `valor`/`percentual` (fator).

Além disso, o tipo `ProjedataOrderPayment` (`order-types.ts`) não tem o campo **fator**, que aparece no ERP (print enviado: Dias / Tipo / Fator / Forma Recebimento) e é obrigatório para representar valor (tipo V) ou percentual (tipo P).

## Mudanças (apenas backend de sync — não toca UI)

### 1. `supabase/functions/_shared/projedata/order-types.ts`
Adicionar `fator: number` em `ProjedataOrderPayment`.

### 2. `supabase/functions/_shared/projedata/order-loader.ts`
- Carregar parcelas de `order_payment_conditions` (ordenadas por `parcela`).
- Coletar todos os `payment_method` distintos das parcelas + o do cabeçalho e buscar de uma vez em `payment_method_erp_mapping` (cache em Map).
- Para cada parcela montar:
  - `dias` (aceita 0)
  - `forma_recebimento` = código ERP do método daquela parcela (fallback ao método do cabeçalho se a parcela não tiver método).
  - `tipo` = `'V'` ou `'P'` conforme registro.
  - `fator` = `valor` quando tipo `V`; `percentual` quando tipo `P`; senão `0`.
  - `parcela` = índice sequencial (1..N).
- Fallback de retrocompatibilidade: se `order_payment_conditions` estiver vazio, manter o parse atual de `payment_terms` + `payment_method` (com `fator: 0` e tipo `'P'`), preservando o comportamento legado.
- `payment_method_mapped` continua refletindo se todos os métodos usados nas parcelas têm mapeamento ERP.

### 3. `supabase/functions/_shared/projedata/order-mapper.ts`
Incluir `fator` no objeto `pagto[]` retornado por `mapCRMOrderToProjedata` e no `buildOrderPayload`.

### 4. `supabase/functions/_shared/projedata/order-validator.ts`
- Permitir `dias = 0` (parcela à vista). Rejeitar apenas `dias < 0` ou nulo.
- Para tipo `'V'` validar `fator > 0`; para tipo `'P'` validar `fator > 0` e somatório de percentuais = 100 (com tolerância 0,01).
- Continuar exigindo `forma_recebimento` por parcela.

### 5. Reenfileirar o pedido
Após o deploy, sinalizar para o usuário reenviar `PED-2026-0072` para o ERP (botão de sync) — nenhuma migration necessária.

## Fora de escopo
- UI do `PaymentConditionsEditor` (já está correto, salvando em `order_payment_conditions`).
- Propostas (`proposal_payment_conditions`) — só ajustar quando houver sync de propostas para ERP.
- Mudanças no schema do banco.
