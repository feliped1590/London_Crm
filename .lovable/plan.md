## Objetivo

No cadastro de produto, quando o grupo selecionado tiver "bobina" no nome, exibir apenas **Largura** e **Espessura**. Para qualquer outro grupo, exibir as três dimensões (Largura, Comprimento, Espessura).

## Como hoje

Existe a coluna `dimension_profile` em `product_groups` com valores `full` / `partial` / `none`, lida via `getGroupProfile(grupoId)` em `src/pages/Products.tsx` (linha 278). O perfil já controla quais campos aparecem e a geração de SKU/versão. Hoje ele depende exclusivamente do que está cadastrado no banco — se o admin não marcou o grupo como `partial`, a tela mostra os 3 campos mesmo para "Bobina".

## Mudança proposta (somente frontend)

Ajustar `getGroupProfile` em `src/pages/Products.tsx` para aplicar uma regra automática por nome, **sem alterar banco, sem alterar sincronização ERP, sem alterar `dimension_profile` do grupo**:

1. Buscar o grupo pelo `grupoId` na lista `grupos.items` (como já faz).
2. Se o `name` do grupo, normalizado (lowercase, sem acentos), contiver a palavra `bobina` → retornar `'partial'`.
3. Caso contrário → retornar `group?.dimension_profile || 'full'` (fallback passa de `'none'` para `'full'` para garantir as 3 dimensões em grupos não-bobina, conforme pedido: "o restante, aparecem todas as dimensões").

Como toda a renderização condicional dos inputs de dimensão, validação e geração de SKU/versão já consomem `currentDimensionProfile = getGroupProfile(...)`, a mudança propaga automaticamente para:
- Renderização dos campos Largura / Comprimento / Espessura
- Validação de submit
- `recalcularDescricao` / `generateStructuralSku` / geração de `erp_versao`

## Fora de escopo

- Schema do banco (`dimension_profile` permanece como está)
- Sincronização ERP / hashes / triggers
- Tabela de grupos em "Cadastro Básico" (continua permitindo configurar `dimension_profile` manualmente; a regra por nome só é um override no formulário de produto)
- Qualquer outro campo do formulário

## Memória

Atualizar `mem://features/product-lookups-basic-records` adicionando: "No formulário de produto, grupos cujo nome contém 'bobina' (case/acento-insensível) forçam perfil `partial` (Largura × Espessura), sobrepondo `dimension_profile`. Demais grupos exibem as 3 dimensões."
