## Problema

Os 5 cards do dashboard estão se sobrepondo:

- **Leads** e **Prospects** contam empresas pelo `lifecycle_stage`
- **Clientes Ativos / Inativos / Perdidos** contam pelo `activity_status` aplicado a **todas** as empresas

Resultado: um lead com qualquer interação aparece em "Leads" **e** em "Clientes Ativos" simultaneamente. A soma passa de 100% da base.

Diagnóstico no banco confirma:
- 20.057 leads classificados como "ativo"
- 8.626 prospects classificados como "ativo"
- 4.888 clientes reais classificados como "ativo"
- 0 inativos / 0 perdidos (o backfill aplicou `lifecycle_baseline_at = now()` para todos, "zerando o relógio")

## Correção proposta

### Regra única e mutuamente exclusiva

Cada empresa entra em **exatamente um** dos 5 grupos:

| Card | Critério |
|------|----------|
| Leads | `lifecycle_stage = 'lead'` |
| Prospects | `lifecycle_stage = 'prospect'` |
| Clientes Ativos | `lifecycle_stage = 'customer_active'` **E** última interação ≤ 6 meses |
| Clientes Inativos | `lifecycle_stage = 'customer_active'` **E** última interação entre 6 e 12 meses |
| Clientes Perdidos | `lifecycle_stage = 'customer_active'` **E** última interação > 12 meses |

O eixo `activity_status` (ativo / inativo / perdido) **passa a se aplicar apenas a clientes** — leads e prospects não recebem mais essa classificação (ficam `NULL`).

### O que muda

1. **Função `recompute_company_lifecycle`**: passa a só calcular `activity_status` quando `lifecycle_stage = 'customer_active'`. Para lead/prospect, escreve `NULL`.

2. **RPC `get_activity_status_counts`**: filtra `WHERE lifecycle_stage = 'customer_active'` antes de agrupar.

3. **Backfill corretivo**: 
   - Zera `activity_status` de todas as empresas que não são clientes.
   - Recalcula `activity_status` dos clientes reais usando a `last_interaction_at` real. Onde não houver nenhuma interação registrada, usa `companies.created_at` como referência (não mais `now()`), revelando inatividade verdadeira.
   - `lifecycle_baseline_at` deixa de ser usado como "zera o relógio" — vira apenas um marcador opcional.

4. **Percentual nos cards (`LifecyclePanel.tsx`)**: `totalCompanies` passa a somar os 5 cards (leads + prospects + 3 buckets de clientes) — agora dá exatamente 100%.

### Out of scope

- Não mexer na regra de 60 dias de transferência de carteira.
- Não mexer nos gatilhos de promoção (continuam funcionando — só param de marcar lead/prospect como "ativo").
- Sem mudanças na UI além do recálculo do percentual.

## Esperado após aplicar

Com os dados atuais:
- Leads: 20.057 (~52%)
- Prospects: 8.626 (~22%)
- Clientes Ativos / Inativos / Perdidos: 4.888 distribuídos entre os 3 conforme a interação real (provavelmente a maioria como Perdidos, dado que muitos clientes herdados não têm histórico recente no CRM)
- **Soma = 100%**