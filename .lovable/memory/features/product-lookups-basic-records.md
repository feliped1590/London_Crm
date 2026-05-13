# Memory: features/product-lookups-basic-records
Updated: now

O sistema de cadastro de produtos utiliza tabelas de consulta dinâmicas alinhadas à nomenclatura do ERP (Iniflex):

- **Tipos** (`product_types`) — campo `tipo_id` (UUID FK)
- **Grupos** (`product_groups`) — campo `grupo_id` (UUID FK) — possui coluna `dimension_profile` (enum: full/partial/none)
- **Subgrupos** (`product_subgroups`) — campo `subgrupo_id` (UUID FK)
- **Famílias** (`product_families`) — campo `family_id` (UUID FK)
- **Classes** (`product_classes`) — campo `class_id` (UUID FK)
- **Unidades de Medida** (`product_unit_measures`) — mantido (sem tenant_id, global)

Todas as colunas de classificação em `products` são UUID FK (não mais TEXT). Índices criados em todas as FK de lookup para performance multiempresa.

Todas as tabelas de lookup (exceto unit_measures) possuem `tenant_id` para isolamento multi-empresa. Não há hierarquia entre Tipo/Grupo/Subgrupo/Família/Classe — são estruturas independentes.

A coluna `dimension_profile` em `product_groups` define o perfil de dimensão:
- `full` = Largura × Comprimento × Espessura (Saco)
- `partial` = Largura × Espessura (Bobina)
- `none` = sem dimensões obrigatórias

O perfil é lido diretamente do banco — zero hardcode de labels no frontend. A função `getProductDimensionProfile` foi removida em favor de leitura direta via `GroupLookupItem.dimension_profile`.

**Override por nome no formulário de produto:** em `src/pages/Products.tsx`, `getGroupProfile` aplica regra automática — grupos cujo `label` contém "bobina" (case/acento-insensível) forçam perfil `partial` (Largura × Espessura), sobrepondo `dimension_profile`. Demais grupos usam `dimension_profile` do banco com fallback para `'full'` (3 dimensões). Não altera banco nem ERP sync.

A função `compute_product_erp_hash` inclui `tipo_id`, `grupo_id`, `subgrupo_id`, `family_id` e `class_id` para detecção precisa de mudanças na sincronização ERP.

Administradores e desenvolvedores gerenciam esses dados na aba "Cadastro Básico" de Produtos.
