
## Plano: Resolver Definitivamente o Problema de Dados Desatualizados

### Problema Identificado

A imagem mostra que colunas como **CPF**, **Empresa** e **Funil** estão vazias ("-") na tela de Contatos, mesmo tendo dados no banco de dados. Após investigação, confirmei que:

1. **Os dados existem** no banco (contatos têm CPF, company_id vinculado, e deals associados)
2. **A UI está usando cache antigo** do React Query que não reflete os dados atuais

### Causa Raiz

A configuração atual do React Query prioriza performance sobre atualização:

| Configuração | Valor Atual | Impacto |
|--------------|-------------|---------|
| `staleTime` | 5 minutos | Dados em cache são usados por 5 min sem revalidação |
| `refetchOnWindowFocus` | `false` | Trocar de aba não atualiza os dados |
| `refetchOnMount` | não definido (usa default) | Revisitar página pode usar cache stale |

**Resultado**: Usuário vê dados desatualizados e precisa "adivinhar" como atualizar.

### Solucao Proposta

Implementar **3 camadas de proteção** para garantir dados sempre atualizados:

```text
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA 1: QUERIES CRÍTICAS               │
│  Páginas principais forçam refresh ao montar                │
│  staleTime: 0, refetchOnMount: 'always'                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA 2: BOTÃO MANUAL                   │
│  Todas as páginas de listagem têm botão "Atualizar"         │
│  Feedback visual via toast + ícone animado                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CAMADA 3: VISUAL DE LOADING              │
│  Estados de loading claros enquanto busca dados             │
│  Skeleton loaders durante carregamento inicial              │
└─────────────────────────────────────────────────────────────┘
```

### Parte 1: Forçar Refresh em Páginas Principais

Atualizar as queries de listagem para sempre buscar dados frescos ao montar a página:

**Antes:**
```typescript
const { data: contacts, isLoading } = useQuery({
  queryKey: ['contacts'],
  queryFn: async () => { /* ... */ },
});
```

**Depois:**
```typescript
const { data: contacts, isLoading, refetch } = useQuery({
  queryKey: ['contacts'],
  queryFn: async () => { /* ... */ },
  staleTime: 0,                    // Sempre considera dados como "stale"
  refetchOnMount: 'always',        // Sempre refaz query ao montar
});
```

### Parte 2: Adicionar Botão de Atualizar

Adicionar botão "Atualizar" no header de cada página de listagem:

```typescript
<div className="flex items-center gap-2">
  <Button 
    variant="outline" 
    size="sm"
    onClick={handleRefresh}
    disabled={isLoading}
    className="gap-2"
  >
    <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
    Atualizar
  </Button>
  {/* outros botões... */}
</div>
```

Com handler padronizado:

```typescript
const handleRefresh = async () => {
  await refetch();
  toast.success('Dados atualizados!');
};
```

### Parte 3: Estado Visual de Carregamento

Garantir que durante a busca de dados, o usuário veja claramente que algo está acontecendo:

1. **Loading inicial**: Spinner centralizado (já existe)
2. **Refresh manual**: Ícone do botão gira (animação `animate-spin`)
3. **Background refresh**: Indicador sutil na tabela

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Contacts.tsx` | Adicionar `staleTime: 0`, `refetchOnMount: 'always'`, botão Atualizar |
| `src/pages/Companies.tsx` | Adicionar `staleTime: 0`, `refetchOnMount: 'always'`, botão Atualizar |
| `src/pages/Pipeline.tsx` | Adicionar `staleTime: 0`, `refetchOnMount: 'always'`, botão Atualizar |
| `src/pages/Orders.tsx` | Adicionar `staleTime: 0`, `refetchOnMount: 'always'`, botão Atualizar |
| `src/pages/Products.tsx` | Adicionar `staleTime: 0`, `refetchOnMount: 'always'`, botão Atualizar |
| `src/pages/Tasks.tsx` | Adicionar `staleTime: 0`, `refetchOnMount: 'always'`, botão Atualizar |
| `src/pages/Dashboard.tsx` | Adicionar botão Atualizar no header |

### Exemplo Completo: Contacts.tsx

```typescript
// Query com refresh garantido
const { data: contacts, isLoading, refetch, isFetching } = useQuery({
  queryKey: ['contacts'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('contacts')
      .select('*, companies(name), deals(id, name, stage, value)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  staleTime: 0,
  refetchOnMount: 'always',
});

// Handler de refresh
const handleRefresh = async () => {
  await refetch();
  toast.success('Dados atualizados!');
};

// No JSX - Botão ao lado do campo de busca
<div className="flex items-center gap-4">
  <div className="relative flex-1">
    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input placeholder="Buscar contatos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
  </div>
  <Button 
    variant="outline" 
    size="sm"
    onClick={handleRefresh}
    disabled={isFetching}
    className="gap-2"
  >
    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
    Atualizar
  </Button>
</div>
```

### Comportamento Esperado Após Implementação

1. **Ao abrir Contatos**: Sistema busca dados frescos do banco automaticamente
2. **Ao criar/editar contato**: Tabela atualiza imediatamente (já funciona via invalidateQueries)
3. **Na dúvida**: Usuário clica "Atualizar" e vê feedback visual + toast de confirmação
4. **Trocar de aba e voltar**: Dados são rebuscados ao remontar a página

### Por Que Esta Solucao é Definitiva

| Problema Anterior | Solução |
|-------------------|---------|
| Cache de 5 minutos | `staleTime: 0` - sempre busca dados novos |
| Não atualiza ao voltar na página | `refetchOnMount: 'always'` - sempre refaz query |
| Usuário não sabe como atualizar | Botão "Atualizar" visível e intuitivo |
| Sem feedback de carregamento | Ícone animado + toast de confirmação |

### Impacto em Performance

- **Trade-off**: Mais requests ao servidor, mas dados sempre corretos
- **Mitigação**: As queries são rápidas (poucos ms) e o benefício de UX supera o custo
- **Cache ainda funciona**: Entre visitas à mesma página (sem sair), ainda usa cache local
