# Memory: features/product-lookups-basic-records
Updated: now

O sistema de cadastro de produtos utiliza tabelas de consulta dinâmicas alinhadas à nomenclatura do ERP (Iniflex):

- **Tipos** (`product_types`) — campo `tipo_id` (UUID FK)
- **Grupos** (`product_groups`) — campo `grupo_id` (UUID FK)
- **Subgrupos** (`product_subgroups`) — campo `subgrupo_id` (UUID FK)
- **Famílias** (`product_families`) — campo `family_id` (UUID FK)
- **Classes** (`product_classes`) — campo `class_id` (UUID FK)
- **Unidades de Medida** (`product_unit_measures`) — mantido (sem tenant_id, global)

Todas as colunas de classificação em `products` são UUID FK (não mais TEXT). Índices criados em todas as FK de lookup para performance multiempresa.

Todas as tabelas de lookup (exceto unit_measures) possuem `tenant_id` para isolamento multi-empresa. Não há hierarquia entre Tipo/Grupo/Subgrupo/Família/Classe — são estruturas independentes.

A função `compute_product_erp_hash` inclui `tipo_id`, `grupo_id`, `subgrupo_id`, `family_id` e `class_id` para detecção precisa de mudanças na sincronização ERP.

Administradores e desenvolvedores gerenciam esses dados na aba "Cadastro Básico" de Produtos.
