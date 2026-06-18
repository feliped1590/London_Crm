# Refino dos relatórios do BICenter

Hoje todos os relatórios "individuais" (não compostos) caem no mesmo `ReportRenderer` genérico, que despeja o JSON da RPC quando não reconhece a estrutura (caso do Forecast — daí o "código" aparecendo na tela) e plota **todas** as colunas numéricas no gráfico, sem ordenação nem formatação por relatório. A solução é dupla: (a) ajustes pontuais no renderer genérico e (b) handlers visuais dedicados para os relatórios que precisam de tratamento específico.

## 1. Ajustes no `ReportRenderer` (base para todos)

- **Render de objeto-KPI puro (Forecast):** quando o `data` é um objeto plano só com números (sem arrays nem `kpis`), renderizar como grid de KPI Cards em vez de `<pre>JSON</pre>`.
- **Configuração por relatório** via um novo arquivo `src/components/bi/reportConfigs.ts`:
  - `chartValueKeys`: quais colunas vão para o gráfico (resto fica só na tabela).
  - `chartLabelKey`: coluna do eixo X.
  - `sortBy` + `sortDir`: ordenação default.
  - `columnLabels`: rótulos amigáveis em PT-BR.
  - `columnFormat`: override (`currency` | `number` | `percent` | `date`).
  - `topN`: limite de barras no gráfico (resto continua na tabela).
- Renderer passa a respeitar essa config; sem config cai no comportamento atual.

## 2. Handlers/configs por relatório

### 1. Forecast de Vendas (`forecast_vendas`)
- Substituir o dump JSON por **4 KPI cards** (Meta, Aberto, Fechado, Forecast) + 1 card destaque "% da meta" com barra de progresso colorida (vermelho <70, amarelo 70-99, verde ≥100).
- Adicionar 1 gráfico de barras horizontais comparando Meta vs Forecast vs Fechado.
- Validar dados: conferir se `meta` vem de `sales_goals` do período, se `aberto` soma só deals abertos (não perdidos) e se `forecast = fechado + (aberto * prob média por etapa)`.

### 2. Clientes Atendidos (`clientes_atendidos`)
- Gráfico de linha empilhada: Novos / Recorrentes / Reativados ao longo do tempo.
- KPIs no topo: total atendidos, % novos, % reativados.
- Validar critério "reativado" (sem compra >X dias e voltou) e "novo" (primeira compra no período).

### 3. Vendas por Cliente (`vendas_cliente`) — curva ABC
- Tirar `qtd_pedidos` do gráfico (fica só na tabela).
- Ordenar `valor_total` desc.
- Gráfico de barras Top 20 + linha cumulativa % (curva ABC: A=80%, B=15%, C=5%) com bandas coloridas.
- Coluna extra "classe ABC" na tabela.

### 4. Rankings Dinâmicos (`rankings`)
- Investigar a RPC `report_rankings` para entender saída. Hipótese: hoje é redundante com `vendas_cliente`/`vendas_vendedor`/`vendas_produto`.
- Apresentar duas opções:
  - (a) Transformar em "Top 10 multi-dimensão" (mini-leaderboards lado a lado: clientes, vendedores, produtos, entidades) — função de visão geral rápida.
  - (b) Remover do menu se não agregar valor.
- Decisão fica com o usuário; plano implementa (a) por default.

### 5. Vendas por Vendedor (`vendas_vendedor`)
- Tirar `ticket_medio` do gráfico (mantém na tabela).
- Gráfico de barras ordenado por `valor_total` desc; barra empilhada Pedidos × Valor não — duas séries causam confusão, manter apenas valor.
- Validar: bater com `get_sales_rep_productivity` (mesmo período/escopo).

### 6. Vendas por Produto (`vendas_produto`)
- Tirar `quantidade` e `participacao_pct` do gráfico (ficam na tabela).
- Ordenar por `valor_total` desc, Top 20 no gráfico.
- Validar: filtragem por entidade jurídica e exclusão de cancelados.

### 7. Vendas por Entidade Jurídica (`vendas_entidade`)
- Tirar `qtd_pedidos` e `ticket_medio` do gráfico.
- Gráfico de pizza (ou bar horizontal) só com `valor_total` por entidade.
- Validar: somar 100% e bater com soma de `orders.total_value` do período.

### 8. Metas de Vendas (`metas`)
- Renomear colunas (`vendedor`, `meta`, `realizado`, `% atingida`, `gap`).
- Tirar `percent` do gráfico; gráfico passa a ser barras agrupadas Meta vs Realizado por vendedor, ordenado por % atingida desc.
- Coluna `% atingida` na tabela como **barra de progresso** com cor.
- Validar: bater com widget de meta no Dashboard (`useSalesGoals`).

### 9. Pipeline Comercial (`pipeline_comercial`)
- Tirar `qtd` e `dias_medio` do gráfico (ficam na tabela).
- Gráfico funnel ordenado pela ordem das etapas (`pipeline_stages.order_index`), com valor monetário.
- Tabela com colunas renomeadas e tooltip explicando "Dias médio na etapa" e "Taxa de avanço".
- Validar: bater com `get_pipeline_health`.

### 10. Taxa de Conversão (`conversao`)
- Reapresentar como funil com **3 KPIs claros**: Lead→Negócio %, Negócio→Proposta %, Proposta→Ganho %.
- Mostrar a taxa **entre etapas** (não só absoluta) com setas/percentuais.
- Validar: bater com `get_conversion_by_stage`.

## 3. Validação de dados (cross-check)

Para cada relatório, rodar a RPC com filtro fixo (mesma entidade, últimos 30d) e comparar:
- Soma de valores ⟷ `SELECT sum(total_value) FROM orders WHERE … AND status<>'cancelado'`.
- Contagens ⟷ `count(*)`.
- Vendedor 360 já alinhado com Produtividade na iteração anterior (referência).

Discrepâncias viram tarefas pontuais (correção na RPC ou no filtro do client). Não vamos alterar nenhuma RPC nesta fase, exceto se a divergência for óbvia (ex: faltar `WHERE status<>'cancelado'`).

## Detalhes técnicos (referência)

### Arquivos a alterar
- `src/components/bi/ReportRenderer.tsx` — render objeto-KPI, leitura de config.
- `src/components/bi/reportConfigs.ts` *(novo)* — config por `ReportCode`.
- `src/components/bi/renderers/ForecastRenderer.tsx` *(novo)* — handler dedicado.
- `src/components/bi/renderers/ConversionFunnelRenderer.tsx` *(novo)*.
- `src/components/bi/renderers/MetasRenderer.tsx` *(novo)* — barras de progresso.
- `src/components/bi/renderers/AbcRenderer.tsx` *(novo)* — curva ABC para `vendas_cliente`.
- `src/components/bi/renderers/RankingsRenderer.tsx` *(novo)* — mini-leaderboards.
- `src/pages/BICenter.tsx` — roteamento entre renderer genérico e dedicados.

### RPCs envolvidas (somente leitura nesta fase)
`report_forecast_vendas`, `report_clientes_atendidos`, `report_vendas_cliente`, `report_rankings`, `report_vendas_vendedor`, `report_vendas_produto`, `report_vendas_entidade`, `report_metas`, `report_pipeline_comercial`, `report_conversao`.

### Fora de escopo
- Alterações em qualquer RPC SQL.
- Mudanças nos blocos compostos (`executivo_comercial`, `vendedor_360`).
- Export PDF (já existe — só precisa renderizar bem os novos componentes).

## Validação final
Para cada um dos 10 relatórios, abrir `/bi?r=<code>` com Fernanda Massi + 30d e conferir:
1. Nenhum JSON cru aparecendo.
2. Gráfico só com as métricas pedidas.
3. Ordenação correta (maior → menor onde aplicável).
4. Total bate com query SQL de referência.
