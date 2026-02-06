
# Plano: Correções no Remanejamento de Carteira e Histórico de Pedidos

## Visão Geral

Este plano aborda duas correções importantes solicitadas:

1. **Remanejamento de Carteira** - Não exibe todos os clientes da base, especialmente aqueles sem vendedor vinculado
2. **Histórico de Pedidos** - Falta uma aba na tela de detalhes do cliente mostrando os pedidos relacionados

---

## Problema 1: Remanejamento Não Mostra Todos os Clientes

### Diagnóstico

Após análise do código, foram identificados **dois problemas**:

1. **Query desabilitada por padrão**: A busca de empresas só é executada quando pelo menos um filtro está preenchido:
   ```typescript
   enabled: Object.keys(filters).some(k => {
     const val = filters[k as keyof ReallocationFilters];
     if (Array.isArray(val)) return val.length > 0;
     return val !== undefined && val !== null && val !== '';
   })
   ```

2. **Falta opção "Sem vendedor"**: O filtro de vendedor atual não permite selecionar explicitamente clientes sem responsável vinculado

### Solução Proposta

| Alteração | Arquivo |
|-----------|---------|
| Remover condição `enabled` que bloqueia a query inicial | `src/hooks/usePortfolioReallocation.ts` |
| Adicionar opção "Sem vendedor" no filtro | `src/components/reallocation/ReallocationFilters.tsx` |
| Ajustar RPC para suportar filtro `owner_id IS NULL` | Nova migration SQL |
| Remover ou aumentar limite de paginação (de 200 para 1000) | `src/hooks/usePortfolioReallocation.ts` |

### Detalhes Técnicos

**Hook `usePortfolioReallocation.ts`**:
- Remover a propriedade `enabled` para permitir busca inicial sem filtros
- Aumentar `p_limit` de 200 para 1000 (ou remover limite para paginação completa)
- Adicionar flag `noOwner: boolean` para filtrar clientes sem vendedor

**Componente `ReallocationFilters.tsx`**:
- Adicionar opção "Sem vendedor" no Select de vendedor atual com valor especial `'__none__'`

**Migration SQL**:
- Modificar a função `get_companies_for_reallocation` para aceitar parâmetro `p_no_owner boolean` e filtrar por `owner_id IS NULL`

---

## Problema 2: Histórico de Pedidos no Detalhe do Cliente

### Diagnóstico

- A tabela `orders` possui coluna `company_id` que referencia `companies`
- Existem pedidos vinculados a empresas no banco de dados
- Atualmente a página `CustomerDetail.tsx` possui 7 abas, mas nenhuma exibe pedidos
- A tabela `crm_orders` (ERP) está vinculada via `crm_clients` e não diretamente a `companies`

### Solução Proposta

Criar uma nova aba **"Pedidos"** na página de detalhes do cliente que exiba:
- Pedidos da tabela `orders` (CRM) para clientes CRM
- Pedidos da tabela `crm_orders` (ERP) para clientes ERP (via join com `crm_clients` por CNPJ)

| Alteração | Arquivo |
|-----------|---------|
| Criar componente de listagem de pedidos do cliente | `src/components/customers/CustomerOrdersTab.tsx` (novo) |
| Adicionar nova aba na página de detalhes | `src/pages/CustomerDetail.tsx` |

### Detalhes Técnicos

**Novo componente `CustomerOrdersTab.tsx`**:
- Props: `companyId: string`, `source: 'crm' | 'erp'`, `cnpj?: string`
- Para fonte CRM: buscar em `orders` filtrado por `company_id`
- Para fonte ERP: buscar em `crm_orders` via join com `crm_clients` por CNPJ
- Exibir tabela com colunas: Número, Data, Valor, Status
- Incluir totalizadores (quantidade e valor total)

**Alteração em `CustomerDetail.tsx`**:
- Adicionar nova aba "Pedidos" no TabsList (entre "Crédito" e "Timeline")
- Renderizar o componente `CustomerOrdersTab` passando os dados adequados

---

## Resumo das Alterações

| Arquivo | Ação |
|---------|------|
| `src/hooks/usePortfolioReallocation.ts` | Modificar: remover `enabled`, aumentar limite, adicionar flag `noOwner` |
| `src/components/reallocation/ReallocationFilters.tsx` | Modificar: adicionar opção "Sem vendedor" |
| Nova migration SQL | Criar: atualizar RPC para suportar `p_no_owner` |
| `src/components/customers/CustomerOrdersTab.tsx` | Criar: novo componente para listar pedidos |
| `src/pages/CustomerDetail.tsx` | Modificar: adicionar aba "Pedidos" |

## Estimativa de Esforço

- Correção do Remanejamento: ~1-2 horas
- Aba de Histórico de Pedidos: ~2-3 horas
- **Total**: 3-5 horas
