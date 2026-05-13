## Objetivo

Permitir vincular subgrupos a grupos (N:N) em "Cadastros Básicos" e, no formulário de produtos, filtrar a lista de subgrupos pelos vínculos do grupo selecionado — reduzindo poluição visual.

**Escopo: apenas organização visual/estrutural do cadastro dentro do CRM. Nenhuma alteração em sincronização ERP.**

## Modelo de dados

Nova tabela de junção `product_group_subgroups`:

```text
product_group_subgroups
- id uuid PK
- group_id uuid FK -> product_groups(id) ON DELETE CASCADE
- subgroup_id uuid FK -> product_subgroups(id) ON DELETE CASCADE
- tenant_id uuid
- created_at timestamptz
- UNIQUE (group_id, subgroup_id)
```

Regras:
- N:N — um subgrupo pode estar em vários grupos e vice-versa.
- RLS por `tenant_id` (mesmo padrão das demais lookups).
- Sem alteração nos campos `grupo_id`/`subgrupo_id` em `products` (continuam UUIDs independentes).
- Compatibilidade: enquanto não houver vínculos para um grupo, o seletor cai no fallback (mostra todos os subgrupos ativos), evitando travar cadastros existentes.

## UI — Cadastros Básicos (`ProductLookupManager.tsx`)

Adicionar ação em **Grupos** e em **Subgrupos**:
- Botão "Vínculos" (ícone link) abre modal com checklist multiselect.
  - Ao abrir pelo Grupo: lista todos os subgrupos ativos com checkbox (marca os já vinculados).
  - Ao abrir pelo Subgrupo: lista todos os grupos ativos com checkbox.
- Salvar faz diff (insere novos / remove desmarcados) em `product_group_subgroups`.
- Badge com contador de vínculos ao lado do nome (ex.: "3 vínculos").

## UI — Formulário de Produto (`src/pages/Products.tsx`)

- Quando `formData.grupo_id` muda:
  - Buscar `subgroup_id`s vinculados a esse grupo.
  - Filtrar `subgrupos.items` exibidos no Select por essa lista.
  - Se o `subgrupo_id` atual não pertence ao novo grupo, limpar o campo.
- Se o grupo não tem vínculos cadastrados → mostrar todos os subgrupos ativos (fallback), com aviso discreto: "Nenhum subgrupo vinculado — exibindo todos".

## Hook

Estender `useProductLookups.ts` com `useGroupSubgroupLinks()`:
- `linksByGroup: Record<groupId, subgroupId[]>`
- `linksBySubgroup: Record<subgroupId, groupId[]>`
- `setGroupLinks(groupId, subgroupIds[])` — diff insert/delete
- `setSubgroupLinks(subgroupId, groupIds[])` — diff insert/delete
- Invalidação de query após mutação.

## Fora de escopo

- **Sincronização ERP**: nenhuma função/edge/payload de sync será tocada. Vínculo é puramente CRM.
- Migração de dados históricos (vínculos começam vazios; usuário cadastra conforme necessidade).
- Aplicar o mesmo filtro fora do formulário de produto (estendível depois sob demanda).

## Entregáveis

1. Migração SQL: tabela `product_group_subgroups` + RLS + índices.
2. Hook `useGroupSubgroupLinks`.
3. Modal reutilizável `GroupSubgroupLinkDialog`.
4. Botões "Vínculos" nas seções Grupos e Subgrupos do `ProductLookupManager`.
5. Filtro do Select de Subgrupo no formulário de produto + reset quando inválido.
6. Atualizar memória `mem://features/product-lookups-basic-records` com a regra N:N (somente CRM).
