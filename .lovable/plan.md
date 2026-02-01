
# Plano: Correção de Campos Faltantes e Atualização de Status

## Resumo dos Problemas Identificados

Dois problemas distintos foram encontrados:

1. **Campos não preenchidos**: A função de listagem (`iniflex-list-correntistas`) não está mapeando corretamente os campos do ERP. O log mostra que o ERP envia `e_mail` (com underscore) mas o código procura `email` (sem underscore).

2. **Status não atualiza**: Existem dois fluxos de importação independentes:
   - **Sincronização (botão "Sincronizar")**: Salva em `crm_clients`
   - **Importação Manual (botão "Importar")**: Salva em `companies`/`contacts`
   
   A verificação de "Importado/Pendente" consulta `companies`/`contacts` (tabelas legadas), mas ignora `crm_clients` (tabela da sincronização).

---

## Parte 1: Correção do Mapeamento de Campos

**Arquivo**: `supabase/functions/iniflex-list-correntistas/index.ts`

### Alterações Necessárias

Corrigir o mapeamento na linha 89-99 para usar os nomes corretos dos campos do ERP:

| Campo CRM | Nome no ERP (atual) | Mapeamento atual | Correção |
|-----------|---------------------|------------------|----------|
| email | `e_mail` | `c.email` ❌ | `c.e_mail` ✓ |
| insc_estadual | `insc_estadual` | não mapeado ❌ | adicionar ✓ |
| endereco | `loc_endereco` | não mapeado ❌ | adicionar ✓ |
| cidade | `desc_loc_cidade` | `c.cidade` ❌ | `c.desc_loc_cidade` ✓ |
| estado | `loc_uf` | `c.estado` ❌ | `c.loc_uf` ✓ |

### Interface Correntista Atualizada

```typescript
interface Correntista {
  id: string;
  cnpj_cpf: string;
  nome: string;
  fantasia?: string;
  email?: string;      // será preenchido corretamente
  fone?: string;
  pfpj: string;
  cidade?: string;     // será preenchido corretamente
  estado?: string;     // será preenchido corretamente
  // Novos campos:
  insc_estadual?: string;
  endereco?: string;
  bairro?: string;
  cep?: string;
}
```

---

## Parte 2: Correção do Status de Importação

**Arquivo**: `src/components/integrations/InflexTab.tsx`

### Problema

A função `isImported()` verifica apenas as tabelas `companies` e `contacts`:

```typescript
// Código atual - só verifica tabelas legadas
const isImported = (correntista: Correntista) => {
  if (isPJ) return existingCompanies?.has(correntista.id);
  return existingContacts?.has(correntista.id);
};
```

### Solução

Adicionar consulta à tabela `crm_clients` e considerar ambas as fontes:

```typescript
// Nova query para buscar clientes sincronizados
const { data: syncedClients } = useQuery({
  queryKey: ['crm-clients-external-ids'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('crm_clients')
      .select('external_id');
    if (error) throw error;
    return new Set(data.map(c => c.external_id));
  },
});

// Função isImported atualizada
const isImported = (correntista: Correntista) => {
  // Verifica se foi sincronizado (crm_clients)
  if (syncedClients?.has(correntista.id)) return true;
  
  // Verifica importação manual (companies/contacts)
  const isPJ = correntista.pfpj === 'PJ' || correntista.cnpj_cpf?.length > 11;
  if (isPJ) return existingCompanies?.has(correntista.id);
  return existingContacts?.has(correntista.id);
};
```

---

## Parte 3: Invalidação de Cache Após Sincronização

**Arquivo**: `src/components/integrations/InflexTab.tsx`

### Problema

Após a sincronização, o cache não é invalidado, então os stats não atualizam.

### Solução

```typescript
const syncMutation = useMutation({
  // ...
  onSuccess: (data) => {
    toast.success(`Sincronização concluída: ${data.processed} clientes processados`);
    setLastSyncResult(data);
    // Adicionar invalidação do cache
    queryClient.invalidateQueries({ queryKey: ['crm-clients-external-ids'] });
    queryClient.invalidateQueries({ queryKey: ['iniflex-correntistas'] });
  },
});
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/iniflex-list-correntistas/index.ts` | Corrigir mapeamento de campos (`e_mail`, `insc_estadual`, endereço) |
| `src/components/integrations/InflexTab.tsx` | Adicionar query para `crm_clients` e atualizar `isImported()` |

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────┐
│                    FLUXO CORRIGIDO                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   1. Listagem (ERP → Interface)                             │
│      ├── e_mail → email ✓                                   │
│      ├── insc_estadual → insc_estadual ✓                    │
│      ├── desc_loc_cidade → cidade ✓                         │
│      └── loc_uf → estado ✓                                  │
│                                                             │
│   2. Status "Importado"                                     │
│      ├── Verificar crm_clients.external_id ✓ (prioridade)   │
│      ├── Verificar companies.iniflex_id                     │
│      └── Verificar contacts.iniflex_id                      │
│                                                             │
│   3. Após Sincronização                                     │
│      └── Invalidar cache → Atualizar contadores ✓           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

Após as correções:

1. **E-mail** aparecerá na lista e na tela de cliente
2. **Inscrição Estadual** aparecerá preenchida
3. **Endereço, Cidade e Estado** serão exibidos corretamente
4. **Status "Importado"** refletirá clientes sincronizados via `crm_clients`
5. **Contadores** (Importados/Pendentes) serão atualizados após sincronização
