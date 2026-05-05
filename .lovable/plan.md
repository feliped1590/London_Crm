# Fix: Banco padrão 999 bloqueando envio ao ERP

## Causa
O **simulador de payload** já aplica fallback `banco_padrao = 999` (CAIXA/CARTEIRA) quando o cliente não tem `company_erp_financial.banco_padrao_erp`. Mas o **validador real** (`validate-company-sync`) envia `null`, e o `company-validator.ts` bloqueia com a mensagem "Banco padrão ERP não configurado para o cliente". Por isso o SEA GOLD falha mesmo com o preview mostrando 999.

## Alterações

### 1. `supabase/functions/validate-company-sync/index.ts` (linha 136)
Aplicar o mesmo fallback do simulador:
```ts
banco_padrao: erpFinancial?.banco_padrao_erp ?? 999,
```

### 2. `supabase/functions/_shared/projedata/company-mapper.ts` (linha 93)
Garantir 999 como default final caso outro caller não envie o contexto:
```ts
banco_padrao: context.banco_padrao ?? 999,
```

### 3. Redeploy
- `validate-company-sync`
- `process-company-sync` (consome o mapper)

## Resultado esperado
Cliente sem banco específico passa a validação e entra na fila do ERP usando 999 (CAIXA/CARTEIRA), idêntico ao preview do simulador. Clientes com `banco_padrao_erp` definido continuam usando o valor específico.
