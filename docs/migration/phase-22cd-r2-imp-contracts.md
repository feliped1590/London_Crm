# Fase 22CD-R2 — Contratos oficiais IMP e ajuste do validador (no-write)

## 1) Objetivo

Registrar oficialmente os contratos dos payloads operacionais Iniflex (`IMP_CLIENTE_V4`, `IMP_ITEM_VERSAO_TESTE`, `IMP_PEDIDO_ESPECIFICO`), ajustar o validador para detectar placeholders e impedir classificação de carga real quando o payload ainda for template.

## 2) Payloads oficiais recebidos

- `IMP_CLIENTE_V4` (clientes/empresas)
- `IMP_ITEM_VERSAO_TESTE` (produtos/versões)
- `IMP_PEDIDO_ESPECIFICO` (pedido diagnóstico)

## 3) Contrato/template vs payload real

- Contrato/template pode conter placeholders (`<...>`, `DD/MM/AAAA HH:MM:SS`, `...`).
- Payload real precisa conter valores concretos para os campos obrigatórios.
- Nesta fase, os templates são `contract_ready=true` e `real_payload_ready=false`.

## 4) Mapeamento IMP_CLIENTE_V4

- `companies.cnpj` <- `cnpj_cpf` (obrigatório, 11/14 dígitos)
- `companies.name` <- `nome` (obrigatório)
- `companies.trade_name` <- `fantasia` (opcional)
- `companies.inscricao_estadual` <- `insc_estadual` (opcional)
- `enderecos`, `enderecos_entrega` e `vendedores`: diagnóstico nesta fase

Regras:

- Sem `cnpj_cpf` real: `blocked_missing_cnpj`/`blocked_placeholder`
- Sem `nome`: `blocked_missing_name`

Idempotência preferencial: `(tenant_id, cnpj)`.

## 5) Mapeamento IMP_ITEM_VERSAO_TESTE

- `products.erp_product_code` <- `codigo`
- `products.sku` <- `codigo` (primeira carga real bloqueia se vazio)
- `products.name` <- `descricao`
- `products.ncm` <- `ncm` (se houver no schema)
- `products.erp_versao` <- `versoes[0].detalhes`
- `products.versao_numero` <- `versoes[0].versao`
- FKs: `tipo_item`, `grupo`, `subgrupo`, `familia`, `classe`

Regras:

- Sem `descricao`: `blocked_missing_name`
- Sem `codigo` (ou regra alternativa aprovada): `blocked_missing_sku_or_erp_code`
- Placeholders em campos-chave: `blocked_placeholder`

Idempotência preferencial: `(tenant_id, erp_product_code, versao_numero)`.

## 6) Diagnóstico IMP_PEDIDO_ESPECIFICO

- Mantido em modo diagnóstico (sem escrita).
- Regras de bloqueio: ausência de cliente, pedido, itens, item ou versão.
- Placeholders em cliente/item/versão/datas também bloqueiam.

## 7) Regras obrigatórias

- Placeholder detectado em campo crítico bloqueia carga real.
- `contract_detected=true` não implica `real_payload_ready=true`.
- `IMP_PEDIDO_ESPECIFICO` permanece diagnóstico nesta fase.

## 8) Templates gerados

Versionáveis:

- `artifacts/migration/phase-22cd-r2-imp-contracts/imp-cliente-v4-contract-template.json`
- `artifacts/migration/phase-22cd-r2-imp-contracts/imp-item-versao-teste-contract-template.json`
- `artifacts/migration/phase-22cd-r2-imp-contracts/imp-pedido-especifico-contract-template.json`

Locais ignorados para preenchimento real:

- `.local/erp-samples/imp-cliente-v4-real-01.json`
- `.local/erp-samples/imp-item-versao-teste-real-01.json`
- `.local/erp-samples/imp-pedido-especifico-real-01.json`

## 9) Validação dos templates

Execução no-write com `phase-22cb-r2-imp-payload-validator.mjs`:

- `companies`: `contract_detected=true`, `real_payload_ready=false`, `ready_candidate=0`, `blocked_placeholder=1`
- `products`: `contract_detected=true`, `real_payload_ready=false`, `ready_candidate=0`, `blocked_placeholder=1`
- `orders`: `contract_detected=true`, `real_payload_ready=false`, `ready_candidate=0`, `blocked_placeholder=1`

## 10) Próxima fase

Preencher os três arquivos `.local/erp-samples/*-real-01.json` com dados reais e revalidar em no-write antes de qualquer gate de escrita.

## 11) Confirmações obrigatórias

- chamada ERP executada: não
- comando `IMP_*` executado: não
- nova escrita em banco: não
- SQL de escrita executado: não
- payload bruto real commitado: não
- token exposto/versionado: não
- migration: não
- seed/cleanup: não
- rollback: não
- deploy: não
- commit: não
- push: não
- staging/prod alterados: não
