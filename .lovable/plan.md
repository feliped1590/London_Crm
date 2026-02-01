
# Plano: Exibir Todos os Clientes + Busca Automática em Tempo Real

## Resumo do Problema

Existem dois problemas identificados:

| Problema | Situação Atual | Resultado |
|----------|----------------|-----------|
| **Dados faltantes** | A página busca apenas de `companies` (11 registros) | 192 clientes de `crm_clients` não aparecem |
| **Busca não funciona** | Filtro client-side não inclui todos os campos | Pesquisar "thel" não retorna resultados |

---

## Solução Proposta

### 1. Unificar Fonte de Dados

Combinar dados de ambas as tabelas (`companies` + `crm_clients`) em uma única lista:

```text
┌────────────────────────────────────────────────────────────────┐
│                    FONTE DE DADOS UNIFICADA                    │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│   companies (11)  +  crm_clients (192)  =  Lista Unificada     │
│                                                                │
│   - Evitar duplicatas por CNPJ/CPF                             │
│   - companies tem prioridade (dados manuais)                   │
│   - crm_clients complementa (dados do ERP)                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 2. Busca Automática em Tempo Real

Implementar busca com debounce que executa automaticamente:

- **Delay de 300ms** após o usuário parar de digitar
- **Busca em múltiplos campos**: nome, fantasia, CNPJ/CPF, endereço, cidade, estado, telefone, email
- **Sem necessidade de pressionar Enter ou botão**

---

## Alterações Detalhadas

### Arquivo 1: `src/pages/Customers.tsx`

#### Alteração A: Adicionar Query para `crm_clients`

```typescript
// Nova query para buscar clientes do ERP
const { data: crmClients } = useQuery({
  queryKey: ['crm-clients-list'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('crm_clients')
      .select(`
        id,
        razao_social,
        nome_fantasia,
        cnpj_cpf,
        telefone,
        celular,
        emails,
        regiao,
        raw_data,
        tipo_pessoa,
        insc_estadual
      `);
    if (error) throw error;
    return data;
  },
});
```

#### Alteração B: Combinar os Dados

```typescript
// Combinar companies + crm_clients, evitando duplicatas
const allCustomers = useMemo(() => {
  const companiesSet = new Set(
    customers?.map(c => c.cnpj?.replace(/\D/g, ''))
  );
  
  const companiesList = customers || [];
  
  // Adicionar clientes do ERP que não existem em companies
  const erpClients = (crmClients || [])
    .filter(c => !companiesSet.has(c.cnpj_cpf?.replace(/\D/g, '')))
    .map(c => ({
      id: c.id,
      name: c.nome_fantasia || c.razao_social || '',
      // ... mapear demais campos
    }));

  return [...companiesList, ...erpClients];
}, [customers, crmClients]);
```

#### Alteração C: Implementar Debounce para Busca

```typescript
import { useCallback, useEffect, useState } from 'react';

// Estado para debounce
const [debouncedSearch, setDebouncedSearch] = useState('');

// Debounce effect
useEffect(() => {
  const timer = setTimeout(() => {
    setDebouncedSearch(search);
  }, 300);
  return () => clearTimeout(timer);
}, [search]);
```

#### Alteração D: Expandir Campos de Busca

```typescript
const filteredCustomers = allCustomers?.filter(customer => {
  if (!debouncedSearch) return true;
  
  const searchLower = debouncedSearch.toLowerCase();
  const searchDigits = debouncedSearch.replace(/\D/g, '');
  
  return (
    customer.name?.toLowerCase().includes(searchLower) ||
    customer.fantasia?.toLowerCase().includes(searchLower) ||
    customer.cnpj?.includes(searchDigits) ||
    customer.address?.toLowerCase().includes(searchLower) ||
    customer.city?.toLowerCase().includes(searchLower) ||
    customer.state?.toLowerCase().includes(searchLower) ||
    customer.phone?.includes(searchDigits) ||
    customer.email?.toLowerCase().includes(searchLower) ||
    customer.primary_contact?.name.toLowerCase().includes(searchLower)
  );
});
```

---

## Interface Atualizada

O tipo `CustomerListItem` será expandido para incluir:

```typescript
interface CustomerListItem {
  // Campos existentes...
  
  // Novos campos do ERP:
  address?: string;       // Endereço
  neighborhood?: string;  // Bairro
  cep?: string;           // CEP
  insc_estadual?: string; // Inscrição Estadual
  source: 'crm' | 'erp';  // Origem do dado
}
```

---

## Fluxo de Busca

```text
Usuário digita "thel"
        │
        ▼ (aguarda 300ms)
┌────────────────────────────────────────┐
│         BUSCA AUTOMÁTICA               │
├────────────────────────────────────────┤
│                                        │
│  Campos pesquisados:                   │
│  ✓ Nome / Nome Fantasia                │
│  ✓ CNPJ / CPF                          │
│  ✓ Endereço                            │
│  ✓ Cidade / Estado                     │
│  ✓ Telefone / Celular                  │
│  ✓ E-mail                              │
│  ✓ Nome do contato principal           │
│                                        │
└────────────────────────────────────────┘
        │
        ▼
Lista filtrada exibida automaticamente
```

---

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/pages/Customers.tsx` | Adicionar query `crm_clients`, combinar dados, implementar debounce, expandir filtro de busca |

---

## Resultado Esperado

Após a implementação:

1. **Todos os 192+ clientes** serão exibidos na lista
2. **Busca automática** enquanto o usuário digita
3. **Busca por qualquer campo**: nome, CNPJ, endereço, cidade, telefone, etc.
4. **Sem duplicatas**: clientes do ERP que já existem em `companies` não serão repetidos
5. **Performance otimizada** com debounce de 300ms
