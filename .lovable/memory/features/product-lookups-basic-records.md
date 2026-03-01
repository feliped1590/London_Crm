# Memory: features/product-lookups-basic-records
Updated: now

O sistema de cadastro de produtos utiliza tabelas de consulta dinâmicas alinhadas à nomenclatura do ERP (Iniflex):

- **Tipos** (`product_types`) — antigo "Categorias" / `product_categories`
- **Grupos** (`product_groups`) — antigo "Materiais" / `product_materials`
- **Subgrupos** (`product_subgroups`) — antigo "Cores" / `product_colors`
- **Famílias** (`product_families`) — novo
- **Classes** (`product_classes`) — novo
- **Unidades de Medida** (`product_unit_measures`) — mantido

Colunas na tabela `products` renomeadas: `category`→`tipo`, `material`→`grupo`, `color`→`subgrupo`. Campos `family_id` e `class_id` (FK) adicionados.

Todas as tabelas de lookup possuem `tenant_id` para isolamento multi-empresa. Não há hierarquia entre Tipo/Grupo/Subgrupo/Família/Classe — são estruturas independentes.

Administradores e desenvolvedores gerenciam esses dados na aba "Cadastro Básico" de Produtos.
