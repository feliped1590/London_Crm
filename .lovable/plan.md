

# Plano: Incluir Clientes ERP no Remanejamento de Carteira

## Diagnóstico

A tela de Remanejamento de Carteira atualmente exibe apenas **11-12 clientes** porque:

1. A view `company_activity_summary` e a função `get_companies_for_reallocation` consultam **apenas a tabela `companies`** (CRM)
2. A sua base possui **192 clientes no ERP** (`crm_clients`) e apenas **12 no CRM** (`companies`)
3. A maioria dos 199 clientes que você vê na tela de Clientes vem do ERP, que não está incluído no remanejamento

## Solução

Expandir a função de busca para incluir clientes de ambas as fontes (CRM e ERP), unificando-os em uma única listagem para remanejamento.

---

## Alterações Necessárias

| Componente | Alteração |
|------------|-----------|
| Migration SQL | Criar nova view unificada `unified_company_for_reallocation` que combina `companies` + `crm_clients` |
| Migration SQL | Atualizar função `get_companies_for_reallocation` para usar a nova view unificada |
| Hook TypeScript | Ajustar `usePortfolioReallocation.ts` para suportar remanejamento em ambas as tabelas |
| Componente UI | Adicionar indicador visual de origem (CRM/ERP) na tabela de resultados |

---

## Detalhes Técnicos

### 1. Nova View SQL: `unified_company_for_reallocation`

A view unifica clientes de ambas as fontes com estrutura padronizada:

```text
┌─────────────────────────────────────────────────────────────────┐
│                unified_company_for_reallocation                 │
├─────────────────────────────────────────────────────────────────┤
│ company_id          → UUID (id da empresa/cliente)              │
│ company_name        → Nome (CRM: name / ERP: razao_social)      │
│ cnpj                → CNPJ normalizado                          │
│ state               → UF                                        │
│ city                → Cidade                                    │
│ owner_id            → ID do vendedor responsável                │
│ source              → 'crm' | 'erp'                             │
│ regiao              → Região comercial (do ERP)                 │
│ subregiao           → Sub-região                                │
│ active              → Status ativo (CRM: active / ERP: true)    │
│ last_interaction_at → Último atendimento (agregado)             │
│ last_order_at       → Última venda                              │
│ total_orders        → Quantidade de pedidos                     │
│ total_order_value   → Valor total de pedidos                    │
└─────────────────────────────────────────────────────────────────┘
```

**Lógica de deduplicação**: Clientes com mesmo CNPJ aparecem apenas uma vez, priorizando o registro CRM (que pode ter sido enriquecido manualmente).

### 2. Atualização da Função RPC

A função `get_companies_for_reallocation` será atualizada para:
- Consultar a nova view unificada
- Incluir coluna `source` no retorno para identificar a origem
- Manter todos os filtros existentes funcionando

### 3. Ajuste no Hook de Transferência

O hook `usePortfolioReallocation.ts` será modificado para:
- Identificar a origem do cliente (`source: 'crm' | 'erp'`)
- Fazer update na tabela correta: `companies` para CRM, `crm_clients` para ERP
- Registrar a transferência com a informação de origem

### 4. Indicador Visual na Tabela

A tabela de resultados (`ReallocationResultsTable.tsx`) exibirá um badge indicando a origem:
- **CRM** → Badge azul
- **ERP** → Badge laranja

---

## Arquivos Modificados

| Arquivo | Ação |
|---------|------|
| Nova migration SQL | Criar view unificada e atualizar função RPC |
| `src/hooks/usePortfolioReallocation.ts` | Suportar transferência em ambas as tabelas |
| `src/components/reallocation/ReallocationResultsTable.tsx` | Exibir badge de origem |

---

## Considerações de Segurança

- A transferência de clientes ERP atualizará a coluna `owner_id` em `crm_clients`
- Todas as transferências continuam sendo registradas em `portfolio_transfers` para auditoria
- A lógica de governança de carteira permanece ativa para ambas as fontes

