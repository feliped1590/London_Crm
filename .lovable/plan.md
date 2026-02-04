
# Plano: Corrigir Vinculacao de Vendedor

## Problema Identificado

O erro "violates foreign key constraint" ocorre porque:

| Tabela | `owner_id` referencia | Valor esperado |
|--------|----------------------|----------------|
| `companies` | `auth.users(id)` | `user_id` do profiles |
| `crm_clients` | `profiles(id)` | `id` do profiles |

O codigo atual busca `profiles.id` e usa para ambas as tabelas, mas `companies.owner_id` espera um `user_id` (referencia auth.users).

## Solucao Proposta

### 1. Ajustar a Query de Vendedores

Alterar a query para buscar ambos os IDs:

```typescript
const { data: sellers } = useQuery({
  queryKey: ['sellers-for-assignment'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, user_id, full_name')  // Adicionar user_id
      .order('full_name');
    if (error) throw error;
    return data || [];
  },
  enabled: isAdmin,
});
```

### 2. Corrigir a Mutation de Atribuicao

Usar o ID correto baseado na origem do cliente:

```typescript
const assignOwnerMutation = useMutation({
  mutationFn: async (profileId: string | null) => {
    const isErp = customer?.source === 'erp';
    const tableName = isErp ? 'crm_clients' : 'companies';
    
    // Para companies: usar user_id
    // Para crm_clients: usar profile id
    let ownerIdToSave = null;
    if (profileId && profileId !== 'none') {
      const seller = sellers?.find(s => s.id === profileId);
      ownerIdToSave = isErp ? profileId : seller?.user_id;
    }
    
    const { error } = await supabase
      .from(tableName)
      .update({ owner_id: ownerIdToSave })
      .eq('id', id);
    if (error) throw error;
  },
  ...
});
```

### 3. Corrigir Exibicao do Vendedor Atual

Para clientes CRM (`companies`), o `owner_id` armazenado e um `user_id`, entao precisamos encontrar o seller correspondente:

```typescript
const currentOwner = React.useMemo(() => {
  if (!customer?.owner_id || !sellers) return null;
  
  if (customer.source === 'erp') {
    // crm_clients armazena profile.id
    return sellers.find(s => s.id === customer.owner_id);
  } else {
    // companies armazena user_id
    return sellers.find(s => s.user_id === customer.owner_id);
  }
}, [customer?.owner_id, customer?.source, sellers]);
```

### 4. Corrigir Valor do Select

O `Select` precisa usar o ID correto para comparacao:

```typescript
// Determinar o valor atual para o Select baseado no tipo de cliente
const selectValue = React.useMemo(() => {
  if (!customer?.owner_id) return 'none';
  
  if (customer.source === 'erp') {
    return customer.owner_id; // crm_clients usa profile.id
  } else {
    // companies usa user_id, precisamos encontrar o profile.id correspondente
    const seller = sellers?.find(s => s.user_id === customer.owner_id);
    return seller?.id || 'none';
  }
}, [customer?.owner_id, customer?.source, sellers]);
```

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/CustomerDetail.tsx` | Query de sellers + logica de mutation + exibicao |

## Fluxo Corrigido

```text
+---------------------------+
|   Admin seleciona seller  |
|   (profile.id no Select)  |
+-------------+-------------+
              |
              v
+---------------------------+
|   Mutation recebe o id    |
+-------------+-------------+
              |
    +---------+---------+
    |                   |
    v                   v
+-------+          +--------+
|  ERP  |          |  CRM   |
+-------+          +--------+
    |                   |
    v                   v
crm_clients         companies
owner_id =          owner_id = 
profile.id          seller.user_id
```

## Resumo das Alteracoes

1. Query de sellers: adicionar `user_id` aos campos selecionados
2. Mutation: usar `user_id` para companies, `id` para crm_clients
3. Exibicao: comparar com campo correto baseado na origem
4. Select value: converter corretamente entre os IDs
