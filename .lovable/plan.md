## Ajuste

Quando `tipo === 'P'` (percentual / rateio automático), **não enviar** o campo `fator` no objeto `pagto[]`. O ERP calcula o saldo sozinho e rejeita quando recebe `fator=0`.

Para `tipo === 'V'` (valor fixo), continuar enviando `fator` normalmente.

## Mudanças

### 1. `supabase/functions/_shared/projedata/order-types.ts`
Tornar `fator` opcional em `ProjedataOrderPayment`:
```ts
fator?: number;
```

### 2. `supabase/functions/_shared/projedata/order-mapper.ts`
No mapeamento de `pagto[]`, incluir `fator` apenas se `tipo === 'V'`:
```ts
const pagto = conditions.map(p => {
  const base = { parcela, dias, forma_recebimento, tipo };
  return p.tipo === 'V' ? { ...base, fator: p.fator ?? 0 } : base;
});
```

### 3. `supabase/functions/_shared/projedata/order-validator.ts`
- Para `tipo === 'V'`: continuar exigindo `fator > 0`.
- Para `tipo === 'P'`: não validar `fator` (campo ignorado).
- Manter validação de soma 100% apenas se houver percentuais explícitos vindos de outra origem (na prática, agora P sempre = rateio automático).

### 4. Deploy
Redeploy de `process-order-sync` e `validate-order-sync`. Reenfileirar `PED-2026-0072`.

## Fora de escopo
- Schema do banco, UI do `PaymentConditionsEditor`, sync de propostas.
