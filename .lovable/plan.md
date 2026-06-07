## Objetivo

Permitir cadastrar a **comissão padrão de cada vendedor** como uma regra nível 5 (`sales_rep_id` preenchido, demais nulos) em `commission_rules`, sem schema novo e sem motor paralelo. A hierarquia "mais específico vence" já documentada no ADR continua valendo.

## Mudanças

### 1. `CommissionRulesManager.tsx` — habilitar escopo
Hoje o modal só edita `name / base / default_pct / max_pct / priority / is_active` e o texto diz "seletores em fase futura". Vamos adicionar:

- **Combobox de Vendedor** (`sales_rep_id`) — reaproveita o componente `ComboSelect` já criado em `PaymentRulesManager.tsx` (extrair para `src/components/settings/governance/_ComboSelect.tsx`).
- **Combobox de Cliente** (`company_id`).
- **Combobox de Produto** (`product_id`).
- **Combobox de Grupo / Subgrupo de produto** (`product_group_id`, `product_subgroup_id`) — tabelas `product_groups` / `product_subgroups`.

Todos opcionais. Regra sem nenhum escopo = "geral do tenant" (já suportada).

### 2. Botão de atalho "Comissão padrão do vendedor"
No header do `CommissionRulesManager`, ao lado de **Nova regra**, adicionar **+ Padrão por vendedor**. Abre o mesmo modal já com:

- `name` = `Padrão {nome_do_vendedor}` (auto-preenchido ao escolher).
- `sales_rep_id` pré-selecionado e demais escopos travados em null.
- `priority = 10` (acima da geral, abaixo das específicas).

É só uma UX shortcut — gera uma linha normal em `commission_rules`.

### 3. Coluna "Escopo" na listagem
Substituir/adicionar coluna que mostra o escopo resolvido em chips:
`Vendedor: João` · `Cliente: Acme` · `Produto: X` · ou `Geral`.

### 4. Indicador de cobertura por vendedor (opcional, leve)
Aba **Regras de Comissão** ganha um banner colapsável "Vendedores sem regra padrão (N)" listando `sales_reps` ativos sem regra nível-5 ativa. Um clique abre o modal já pré-preenchido. Ajuda a garantir que todo vendedor tenha um default.

### 5. Resolver (`resolve_commission_rule`)
Já implementa "mais específico vence". **Sem mudança**. Validar via QA:
- Vendedor com regra nível 5 + sem regra mais específica → retorna a do vendedor.
- Vendedor com regra nível 5 + regra vendedor+produto → retorna a vendedor+produto.
- Vendedor sem regra nível 5 → cai na regra geral do tenant (se houver) ou `NULL`.

### 6. Memória
Atualizar `mem://features/commercial-governance` adicionando:
> Comissão padrão por vendedor = regra nível 5 em `commission_rules` (`sales_rep_id` preenchido, demais nulos). Sem schema dedicado. UI tem atalho "Padrão por vendedor" no `CommissionRulesManager`.

## O que NÃO muda

- Schema de `commission_rules` (já tem todas as colunas).
- RPC `resolve_commission_rule`.
- Snapshot, fluxo de exceção e gate de transição de status.
- `sales_reps` (sem campo de comissão — fica fora do cadastro do vendedor).

## Riscos

- **Vendedor sem regra padrão** → snapshot fica sem `default_pct`. Mitigado pelo banner de cobertura (item 4) e pela regra geral do tenant como fallback final.
- **Duplicidade**: dois nível-5 ativos para o mesmo vendedor. Mitigado por validação no save (`UNIQUE` parcial não dá pois `priority` muda) → trigger leve `BEFORE INSERT/UPDATE` que avisa via `RAISE NOTICE` ou apenas usa `ORDER BY priority DESC` no resolver (já faz). Sugestão mínima: aviso na UI ao tentar criar segundo nível-5 ativo para o mesmo vendedor.

## Entregáveis

1. `_ComboSelect.tsx` compartilhado (extração).
2. `CommissionRulesManager.tsx` com escopo completo + atalho + coluna escopo + banner de cobertura.
3. Memória atualizada.
4. Sem migration.