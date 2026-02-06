

# ✅ Plano Implementado: Incluir Clientes ERP no Remanejamento de Carteira

## Status: CONCLUÍDO

Implementação realizada com sucesso em 06/02/2026.

---

## O que foi feito

### 1. View SQL Unificada
Criada a view `unified_company_for_reallocation` que combina:
- **11 clientes do CRM** (tabela `companies`)
- **189 clientes do ERP** (tabela `crm_clients`)
- **Total: 200 clientes disponíveis para remanejamento**

A view implementa deduplicação por CNPJ, priorizando registros do CRM.

### 2. Função RPC Atualizada
Função `get_companies_for_reallocation` agora:
- Consulta a view unificada
- Retorna coluna `source` ('crm' ou 'erp')
- Mantém todos os filtros funcionando

### 3. Hook de Transferência
`usePortfolioReallocation.ts` atualizado para:
- Identificar origem do cliente via `companySources`
- Atualizar `companies` para clientes CRM
- Atualizar `crm_clients` para clientes ERP
- Registrar origem no log de transferência

### 4. Indicador Visual
`ReallocationResultsTable.tsx` agora exibe badges:
- **CRM** → Badge azul com ícone Cloud
- **ERP** → Badge laranja com ícone Database

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | View `unified_company_for_reallocation` + função RPC |
| `src/hooks/usePortfolioReallocation.ts` | Suporte a transferência em ambas as tabelas |
| `src/components/reallocation/ReallocationResultsTable.tsx` | Badge de origem CRM/ERP |
| `src/pages/PortfolioReallocation.tsx` | Passagem de `companySources` para mutation |
