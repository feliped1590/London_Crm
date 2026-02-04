

# Plano: Vincular Vendedor a Clientes ERP

## Problema Identificado

O card "Vendedor Responsável" não aparece para clientes do ERP porque:
1. Existe uma condição `!isErpCustomer` que oculta o card para clientes sincronizados do ERP
2. A tabela `crm_clients` (ERP) não possui a coluna `owner_id`, enquanto a tabela `companies` (CRM) possui

O cliente atual "A FORMULA" é um cliente ERP, por isso você não vê o card.

## Solução Proposta

### 1. Migração do Banco de Dados
Adicionar a coluna `owner_id` à tabela `crm_clients` para permitir vinculação de vendedor:

```sql
ALTER TABLE crm_clients 
ADD COLUMN owner_id UUID REFERENCES profiles(id);

CREATE INDEX idx_crm_clients_owner_id ON crm_clients(owner_id);
```

### 2. Ajuste no Frontend (CustomerDetail.tsx)

**Mudanças:**
- Remover a condição `!isErpCustomer` do card "Vendedor Responsável"
- Adaptar a mutation `assignOwnerMutation` para atualizar a tabela correta:
  - Se `source === 'crm'` → atualiza `companies`
  - Se `source === 'erp'` → atualiza `crm_clients`
- Incluir `owner_id` no objeto `UnifiedCustomer` retornado para clientes ERP

### 3. Lógica Atualizada

```text
┌─────────────────────────────────────────────────┐
│           Página Detalhe do Cliente             │
├─────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┐   │
│  │   Card: Vendedor Responsável             │   │
│  │   (Visível para Admin em TODOS clientes) │   │
│  │                                          │   │
│  │   [Select: Lista de Vendedores]          │   │
│  │                                          │   │
│  │   Ao salvar:                             │   │
│  │   - CRM → UPDATE companies               │   │
│  │   - ERP → UPDATE crm_clients             │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Detalhes Técnicos

### Arquivo: `src/pages/CustomerDetail.tsx`

**Linha ~829**: Alterar condição do card
```tsx
// DE:
{isAdmin && !isErpCustomer && (

// PARA:
{isAdmin && (
```

**Linha ~276-288**: Adaptar mutation para dual-source
```tsx
const assignOwnerMutation = useMutation({
  mutationFn: async (ownerId: string | null) => {
    const tableName = customer?.source === 'erp' ? 'crm_clients' : 'companies';
    const { error } = await supabase
      .from(tableName)
      .update({ owner_id: ownerId })
      .eq('id', id);
    if (error) throw error;
  },
  ...
});
```

**Linha ~213-236**: Incluir `owner_id` no retorno de clientes ERP
```tsx
return {
  ...
  owner_id: erpData.owner_id, // Adicionar esta linha
  source: 'erp' as const,
  ...
};
```

## Resumo das Alterações

| Item | Tipo | Descrição |
|------|------|-----------|
| `crm_clients.owner_id` | Banco de Dados | Nova coluna UUID com referência a `profiles` |
| Card "Vendedor Responsável" | Frontend | Visível para Admin em todos os clientes |
| `assignOwnerMutation` | Frontend | Atualiza tabela correta baseado na origem |
| Query de clientes ERP | Frontend | Incluir `owner_id` no retorno |

