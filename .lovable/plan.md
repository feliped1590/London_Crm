# Corrigir filtro "Todas acessíveis" nos relatórios BI

## Problema

Quando o usuário clica em **"Todas acessíveis"** no seletor de Entidade Jurídica (Relatório Executivo Comercial, 360 do Vendedor, etc.), a seleção é ignorada e o relatório continua filtrando apenas pela entidade ativa.

**Causa raiz** (`ExecutiveFiltersBar.tsx` e consumidores):

- O `Select` exibe `filters.legalEntityId ?? activeLegalEntityId ?? '__all__'` — ou seja, quando `legalEntityId` vira `null` (escolha do usuário), o valor mostrado cai para `activeLegalEntityId`, e o estado “Todas” nunca é representado.
- `useBIAdvanced.ts` (linha 79) e `CommercialExecutiveReport.tsx` (linha 62) reaplicam o mesmo fallback `?? activeLegalEntityId`, então mesmo que o filtro fosse `null`, a consulta voltaria a filtrar pela entidade ativa.

Resultado: "Todas" é um placeholder visual sem efeito real.

## Solução

Usar **três estados** distintos no filtro:
- `undefined` → não definido ainda (usa entidade ativa do usuário como default inicial)
- `null` → o usuário escolheu explicitamente **Todas acessíveis**
- `string` (UUID) → entidade específica

Com isso `null` passa a ser respeitado em todo o pipeline de filtros — sem fallback automático para a entidade ativa.

## Arquivos a alterar

1. **`src/components/bi/composite/ExecutiveFiltersBar.tsx`**
   - Calcular `selectedValue`: se `legalEntityId === null` → `'__all__'`; se `undefined` → `activeLegalEntityId ?? '__all__'`; senão o próprio id.
   - `onValueChange`: `'__all__'` → `null` (explícito), demais → id.
   - Botão **Resetar** volta a `legalEntityId: undefined` (não força activeLegalEntityId), preservando o comportamento de default inicial.

2. **`src/hooks/useBIAdvanced.ts`**
   - Trocar `filters.legalEntityId ?? activeLegalEntityId ?? undefined` por: se `legalEntityId === null` → não enviar filtro (todas); se `undefined` → cair para `activeLegalEntityId`; senão usar o valor.

3. **`src/components/bi/composite/CommercialExecutiveReport.tsx`**
   - Mesma lógica no cálculo de `filterEntityId` (linha 62) e em todos os `legalEntityId: filters.legalEntityId ?? null` passados ao drill-down — manter o `null` explícito = todas.

4. **`src/components/bi/composite/Seller360Report.tsx`**
   - Aplicar a mesma normalização: `null` propagado significa "todas acessíveis" e não deve ser substituído por `activeLegalEntityId`.

5. **`src/hooks/useBIReports.ts`**
   - Já trata `if (filters.legalEntityId) ...` corretamente (null/undefined = sem filtro). Apenas garantir que o tipo aceite `string | null | undefined`.

6. **`src/components/bi/composite/SalesDrillDownModal.tsx`**
   - Já aplica `if (filters.legalEntityId)` (não filtra quando null). Sem mudança funcional; apenas confirmar tipagem.

## Comportamento esperado após a mudança

- Ao abrir o relatório: filtra pela entidade ativa do usuário (default atual preservado).
- Ao escolher **"Todas acessíveis"**: KPIs, gráficos, rankings, pipeline, perdas, forecast e drill-down passam a consolidar todas as entidades às quais o usuário tem acesso (via `user_legal_entities`/RLS — sem expor entidades fora do escopo).
- Ao escolher uma entidade específica: comportamento inalterado.
- Botão **Resetar** volta ao default (entidade ativa).

## Escopo

Apenas frontend (filtros e propagação). RLS já restringe naturalmente os dados às entidades acessíveis, então "Todas" = "todas as minhas".
