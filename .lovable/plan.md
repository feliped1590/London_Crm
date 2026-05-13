## Objetivo

Unificar a visibilidade de produtos entre todas as entidades jurídicas (CNPJs), igual ao que já acontece com Clientes. Assim, qualquer usuário enxerga todos os produtos do tenant, independentemente da entidade ativa selecionada no topo.

## Mudanças

### 1. Listagem de Produtos (`/products`)
- Remover o filtro por `legal_entity_id` nas queries de contagem e listagem.
- Manter apenas o filtro por tenant (já garantido pela RLS) e os filtros de tipo, status e busca textual.
- Ampliar a busca textual para considerar também: `sku_unique`, `erp_product_code`, `erp_grupo`, `erp_subgrupo`, `erp_versao`, `nome_impresso` (além de `name` e `sku`).
- Ajustar a coluna/indicador da entidade jurídica para apenas exibir a qual CNPJ o produto pertence (informativo), sem filtrar.

### 2. Busca de produtos em Pedidos / Propostas / Documentos
- Aplicar o mesmo princípio em `useProductSearch` (busca usada nos formulários de itens): remover o filtro por `activeLegalEntityId`, mantendo apenas tenant + ativo.
- Garantir que o seletor de produtos nos pedidos liste itens de qualquer CNPJ.

### 3. Criação / Edição de Produto
- O cadastro continua exigindo uma entidade jurídica (campo `legal_entity_id`), pois é exigido para a sincronização com o ERP correspondente.
- Ao criar um novo produto, sugerir a entidade ativa como padrão, mas permitir trocar para qualquer entidade que o usuário tenha acesso.

### 4. Sincronização ERP
- Sem alterações na lógica de sync. Cada produto continua vinculado a uma entidade jurídica (CNPJ) e é sincronizado apenas para o ERP daquela entidade.
- A unificação é apenas de **visibilidade/busca**, não de dados.

### 5. Validação
- Buscar `1-LM-IS-STANDUP- AB FACIL+ZIP LOCK-8-200-340-180` na lista de produtos com qualquer CNPJ ativo: deve aparecer.
- Abrir um pedido em qualquer CNPJ e buscar o mesmo SKU no seletor de itens: deve aparecer.
- Confirmar que ao editar/criar produto a entidade jurídica continua sendo gravada corretamente.

## Pontos de atenção

- **Pricing**: a tabela de preços/regras continua aplicada por entidade. Selecionar um produto de outra entidade em um pedido pode não ter regra de preço associada — nesse caso o sistema cai no preço base, comportamento já existente.
- **Sync ERP**: produtos só sincronizam com o ERP da entidade dona. Isso permanece igual.
- **Memória do projeto**: atualizar Core para refletir que produtos têm visibilidade global por tenant (igual a clientes), mas continuam vinculados a uma entidade jurídica para fins de ERP.