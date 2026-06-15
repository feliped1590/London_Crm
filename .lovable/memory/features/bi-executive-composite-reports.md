---
name: BI Executive Composite Reports
description: Fase 1 — relatórios executivos compostos no BICenter (Executivo Comercial e 360° do Vendedor) reaproveitando RPCs existentes
type: feature
---

## Categoria
Categoria `executivo` (label "Relatórios Executivos") no `BICenter`.

## Códigos compostos
`executivo_comercial` e `vendedor_360` são marcados em `report_definitions` com `chart_type='composite'`.
São renderizados por componentes React dedicados (`CommercialExecutiveReport`, `Seller360Report`), não por RPC.
`useBIReport` ignora composite codes (helper `isCompositeReport`).

## Reuso
Cada bloco consome via `useBIReport` as RPCs já existentes:
`report_dashboard_executivo`, `report_vendas_entidade`, `report_vendas_vendedor`, `report_vendas_cliente`,
`report_vendas_produto`, `report_pipeline_comercial`, `report_perdas_atendimento`, `report_perdas_cotacao`,
`report_forecast_vendas`, `report_conversao`, `report_metas`, `report_clientes_atendidos`.

Nenhuma RPC foi alterada. `ReportRenderer` clássico segue intacto para relatórios individuais.

## Filtros
`ExecutiveFiltersBar` adiciona seletor de entidade jurídica (default = `activeLegalEntityId`) e
seletor de vendedor (obrigatório no `vendedor_360`).

Segurança:
- Vendedor comum: select de vendedor travado no próprio `sales_rep_id`.
- Admin/dev: pode escolher qualquer rep.
- RPCs já aplicam `bi_can_see_rep` / `bi_is_admin_or_dev` no backend.

## Limitação conhecida (Fase 2)
A maioria das RPCs `report_*` não filtra por `legal_entity_id`; o filtro é apenas decorativo
(highlight no chart `Vendas por entidade jurídica`). Para Fase 2, propagar `legal_entity_id` em
todas as RPCs com `WHERE b.legal_entity_id = COALESCE(p_filter, b.legal_entity_id)`.

Atividades/tarefas atrasadas/follow-ups do vendedor: bloco placeholder; depende de novo agregador
(ex.: extensão de `useSellerProductivity`).
