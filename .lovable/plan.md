## Diagnóstico

O produto buscado existe no banco:

- Nome real: `Laminado Transparente Impresso Saco 2 Soldas (NP + Pet Nat) teste 120x150x0,120`
- Termo digitado: `Laminado Transparente Impresso Saco 2 Soldas (NP + Pet Nat) teste 120×150×0,120`

Diferença crítica: o usuário usou `×` (sinal de multiplicação Unicode, U+00D7), enquanto o nome no banco usa `x` (letra minúscula). Como a busca atual aplica um único `ILIKE %texto-completo%`, qualquer divergência mínima (símbolo, acento, espaço extra, ordem das palavras) quebra o match.

Locais afetados:
- `src/hooks/useProductSearch.ts` (seletor de produtos em pedidos/propostas)
- `src/pages/Products.tsx` linhas 437 e 473 (listagem e contagem da página de Produtos)

## Causa raiz

1. Busca monolítica: exige que a string inteira apareça contígua no `name` ou `sku`.
2. Sem normalização de caracteres equivalentes (`×` ↔ `x`, `✕`, acentos, espaços múltiplos).
3. Sem suporte a palavras fora de ordem ou tokens parciais.

## Solução proposta (frontend, sem migration)

### 1. Função utilitária de normalização

Criar `src/utils/search/normalizeSearchTerm.ts`:

- Lowercase
- Remover acentos via `String.normalize('NFD').replace(/\p{Diacritic}/gu, '')`
- Substituir `×`, `✕`, `⨯` → `x`
- Colapsar espaços
- Remover caracteres de pontuação irrelevantes para match (manter dígitos, letras, vírgula, ponto, hífen)

### 2. Tokenização AND

Criar `buildProductSearchFilter(text: string)` que:

- Normaliza o termo
- Divide em tokens por whitespace
- Ignora tokens com menos de 2 caracteres
- Limita a 8 tokens (proteção)
- Para cada token, gera `or(name.ilike.%token%,sku.ilike.%token%)` aplicado sequencialmente (encadeando `.or()` produz AND entre os grupos no PostgREST)

Resultado: a busca aceita palavras em qualquer ordem, com símbolos diferentes, e ainda retorna o produto correto.

### 3. Aplicação

Substituir nos 3 pontos de busca:

- `useProductSearch.ts` linha 42
- `Products.tsx` linha 437
- `Products.tsx` linha 473

Mantém comportamento atual quando o termo é vazio.

### 4. Indexação (sem mudanças agora)

A coluna `name` já tem índice trigram (`pg_trgm`) que continua sendo aproveitado por `ILIKE %x%`. Tokens adicionais apenas adicionam mais filtros AND — performance permanece adequada para o volume atual.

## Fora de escopo

- Migration de unaccent / coluna normalizada (pode ser fase 2 se acentuação no banco virar problema)
- Full-text search com `tsvector`
- Mudanças em busca global (`useGlobalSearch`)

## Riscos

- Tokens muito curtos podem ampliar demais o resultado → mitigado pelo mínimo de 2 caracteres
- Encadeamento de muitos `.or()` aumenta o custo da query → mitigado pelo limite de 8 tokens
- Comportamento muda sutilmente: hoje "abc def" exige a frase exata; após a mudança, encontra qualquer registro que tenha `abc` E `def` em qualquer posição. Esperado e desejado.

## Sequência de implementação

1. Criar utilitário `normalizeSearchTerm` + `buildProductSearchFilter`
2. Aplicar em `useProductSearch.ts`
3. Aplicar nos dois pontos em `Products.tsx`
4. Validar manualmente com o termo problemático e variações