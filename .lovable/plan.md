## Diagnóstico — Karina Moreira Meireles Machado

A meta exibe **R$ 4.617,05 / R$ 400.000,00**, mas a Karina afirma ter fechado mais de R$ 9 mil em junho/2026. Investiguei os deals dela:

**Deals em `fechado_ganho` em junho/2026 (owner_id = Karina):**

| ID (curto) | Valor | closed_at |
|---|---|---|
| 7b60f1eb | R$ 500,00 | 03/06 ✅ |
| 5c4c43e2 | R$ 393,75 | 03/06 ✅ |
| 011aebf7 | R$ 1.417,50 | 02/06 ✅ |
| ac7848a0 | R$ 1.105,80 | 02/06 ✅ |
| 33be74c6 | R$ 700,00 | 01/06 ✅ |
| 703af0d6 | R$ 500,00 | 01/06 ✅ |
| **Subtotal contado** | **R$ 4.617,05** | |
| 78ee7bf4 | R$ 1.300,00 | **NULL** ❌ |
| 68ff0898 | R$ 3.184,60 | **NULL** ❌ |
| **Total real** | **R$ 9.101,65** | |

### Causa raiz

O hook `useSalesGoals` (linha 89-95 de `src/hooks/useSalesGoals.ts`) filtra por `closed_at` entre `period_start` e `period_end`. Como `.gte('closed_at', …)` ignora `NULL`, **deals ganhos sem `closed_at` ficam de fora da meta**.

O `closed_at` só é preenchido no `updateMutation` de `src/hooks/usePipelineData.ts` (linha 380) quando o deal é **movido** para uma etapa de ganho/perdido. Se o deal é **criado já na etapa ganha** (ou via outro fluxo que não passa por esse update — proposta aprovada, importação, automação, etc.), o `closed_at` fica `NULL`.

Não existe trigger no Postgres garantindo essa regra.

## Plano de correção

### 1. Backfill dos deals existentes (migration)

Atualizar todos os deals já em `fechado_ganho`/`fechado_perdido` que estejam com `closed_at IS NULL`, usando `updated_at` como referência (melhor aproximação disponível).

```sql
UPDATE public.deals
SET closed_at = updated_at
WHERE stage IN ('fechado_ganho','fechado_perdido')
  AND closed_at IS NULL;
```

### 2. Trigger defensivo no banco (migration)

Criar trigger `BEFORE INSERT OR UPDATE` em `public.deals`:

- Quando `NEW.stage IN ('fechado_ganho','fechado_perdido')` e `NEW.closed_at IS NULL` → setar `NEW.closed_at = now()`.
- Quando `NEW.stage NOT IN ('fechado_ganho','fechado_perdido')` → manter `closed_at` como está (não limpar, para preservar histórico em caso de reabertura — comportamento atual).

Isso garante a regra independentemente do caminho de criação/edição (UI, edge function, importação, proposta, automação).

### 3. Fallback no hook de meta

Em `src/hooks/useSalesGoals.ts`, trocar o filtro para tolerar dados legados: buscar deals com `stage = 'fechado_ganho'` no período usando `coalesce(closed_at, updated_at)`. Como não dá para fazer `or` em coluna calculada via PostgREST, uso:

```ts
.eq('stage', 'fechado_ganho')
.or(`and(closed_at.gte.${start},closed_at.lte.${end}),and(closed_at.is.null,updated_at.gte.${start},updated_at.lte.${end})`)
```

Assim, mesmo se um deal escapar do trigger no futuro, a meta já o conta.

## Escopo fora do plano

- Não mexer em `sales_rep_id` / `owner_id` (a meta hoje é por `owner_id`, e os deals da Karina estão corretamente com `owner_id` dela).
- Não alterar regras de quem pode marcar deal como ganho.
- Não alterar widgets que já leem corretamente (ex.: funil usa stage direto).

## Arquivos afetados

- Nova migration SQL (backfill + trigger).
- `src/hooks/useSalesGoals.ts` (ajuste do filtro).
