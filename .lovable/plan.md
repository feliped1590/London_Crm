

## Diagnóstico

O componente `SearchableSelect` usa a biblioteca `cmdk` para renderizar a lista de opções. Mesmo com `shouldFilter={false}`, o cmdk continua filtrando internamente os itens baseado no `value` de cada `CommandItem` (que no caso é o UUID da empresa). Quando o usuário digita "brasil", o cmdk tenta casar esse texto com os UUIDs e não encontra correspondência — resultado: todos os itens somem.

Confirmei o bug reproduzindo no navegador: ao digitar "brasil" no seletor de empresa do "Novo Negócio", a lista fica vazia e nenhuma nova requisição ao servidor é disparada.

## Correção

Duas alterações no `src/components/ui/searchable-select.tsx`:

**1. Forçar o cmdk a nunca filtrar localmente:**
Adicionar a prop `filter` ao componente `Command` com uma função que sempre retorna `1`:
```tsx
<Command shouldFilter={false} filter={() => 1}>
```
Isso garante que todos os itens renderizados fiquem visíveis independente do que o usuário digitar.

**2. Corrigir o seletor de empresa no formulário de edição do Pipeline:**
O SearchableSelect de empresas no **diálogo de edição** (linha ~1146 do `Pipeline.tsx`) está **sem `onSearchChange`**, diferente do diálogo de criação que tem `onSearchChange={setCompanySearch}`. Isso significa que ao editar um negócio, a busca de empresas não funciona do lado servidor.

Adicionar `onSearchChange={setCompanySearch}` ao SearchableSelect do formulário de edição.

### Resumo técnico
- `searchable-select.tsx` linha 97: adicionar `filter={() => 1}`
- `Pipeline.tsx` linha ~1155: adicionar `onSearchChange={setCompanySearch}`

