## O que são esses IDs

A tabela "Top Clientes" (e também "Top Produtos" e "Top Vendedores") do **Dashboard Executivo** em `/bi` é renderizada pelo `ReportRenderer` genérico, que monta as colunas a partir de **todas** as chaves retornadas pelo RPC `report_dashboard_executivo`.

O RPC devolve, para cada linha:
- `id` — UUID interno do cliente/produto/vendedor (chave primária no banco)
- `name` — Nome real
- `total` — Faturamento

Como o renderer não filtra nada, ele expõe o `id` como primeira coluna. Esses UUIDs **não têm valor para o usuário final**, são apenas identificadores internos do banco de dados.

## O que mudar

Esconder colunas técnicas no `ReportRenderer` (`src/components/bi/ReportRenderer.tsx`), aplicando o filtro tanto na tabela exibida quanto na exportação CSV.

### Regra de oculto
Esconder qualquer coluna cujo nome:
- seja exatamente `id`
- termine em `_id` (ex.: `company_id`, `product_id`, `sales_rep_id`, `order_id`, `legal_entity_id`, `deal_id`, etc.)

Esses campos continuam disponíveis nos objetos das linhas (para usos futuros tipo drill-down via `onRowClick`), apenas não são renderizados nem exportados.

### Impacto
- "Top Clientes / Produtos / Vendedores" do Dashboard Executivo passam a mostrar **Nome** e **Total** apenas.
- "Vendas por Cliente" (`vendas_cliente`), "Vendas por Produto", "Rankings Dinâmicos" e demais relatórios que usam o renderer genérico também deixam de mostrar `company_id`/`product_id`/etc.
- Os relatórios compostos (`CommercialExecutiveReport`, `Seller360Report`) **não são afetados** — eles já usam `RankingTable` com colunas explícitas.
- Nenhuma mudança em RPC, migration, RLS ou backend.

## Arquivo alterado
- `src/components/bi/ReportRenderer.tsx` — adicionar helper `isHiddenKey(key)` e aplicar em (a) `cols` do `DataBlock`, (b) lista de colunas do CSV em `exportCSV`, (c) `pickChartKeys` para que os ids não virem eixo de gráfico.

## Validação
Após o ajuste, abrir `/bi → Dashboard Executivo` e confirmar que "Top Clientes", "Top Produtos" e "Top Vendedores" mostram apenas Nome + Total, sem coluna de UUID.
