## Objetivo

Substituir o `Select` simples do campo **Classe** (com ~200 opções) por um combobox com busca, no formulário de Novo/Editar Produto.

## Escopo

Apenas o campo **Classe** em `src/pages/Products.tsx` (linhas ~1531-1553). Sem mudanças em backend, schema, regras de negócio ou em outros campos (Família, Grupo, Subgrupo, Tipo, etc. seguem como estão — o usuário só pediu Classe).

## Implementação

1. Criar um pequeno componente local `SearchableSelect` (ou usar inline) baseado em `Popover` + `Command` (`CommandInput`, `CommandList`, `CommandEmpty`, `CommandItem`) do shadcn — padrão já usado em outros comboboxes do projeto.
2. Substituir o bloco do Select da Classe por esse combobox:
   - Botão exibe o `label` da classe selecionada ou "Selecione".
   - Campo de busca filtra por `label` (case-insensitive, com `normalize` para acentos).
   - Item "Nenhuma" no topo.
   - Mesmo `disabled={isEditing}` (preserva imutabilidade estrutural).
   - Mesmo `onValueChange` atual (recalcula SKU e descrição).
3. Manter visual coerente com os demais campos (mesma altura/estilo do `SelectTrigger`).

## Fora do escopo

- Não mexer nas demais listas (subgrupos, famílias, etc.). Se quiser depois, aplicamos o mesmo padrão.
- Sem alterações em `useProductLookups`, types ou tabelas.
