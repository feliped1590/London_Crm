# Fase 13 - Planejamento da migracao e reconciliacao de dados

## 1. Objetivo

Definir um plano tecnico seguro para migracao e reconciliacao de dados, com base em inventario somente leitura do ambiente origem, sem executar migracao nesta fase.

## 2. Escopo

- Inventariar tabelas e volume do schema `public` na origem.
- Classificar tabelas por dominio de negocio e operacional.
- Propor ordem de migracao por dependencia.
- Definir criterios de reconciliacao origem x destino.
- Mapear riscos, bloqueios e recomendacao Go/No-Go.

## 3. Ambientes analisados

- Origem (staging atual): `crm-qualyvac-staging` (`cansbrrwrprcycjvgvqm`)
- Restore test isolado (referencia): `crm-qualyvac-restore-test` (`nsnmlleplpzsefzkuxlb`)
- Escopo desta fase: leitura e documentacao apenas, sem escrita em banco.

## 4. Regras de seguranca

- Sem deploy, sem migracao, sem restore, sem escrita em banco.
- Sem alteracao de codigo funcional, schema, migrations, RLS/policies, UI ou Edge Functions.
- Sem versionamento de dumps, manifestos sensiveis, secrets, tokens ou dados pessoais.
- Relatorio com metadados e contagens apenas.

## 5. Inventario resumido de tabelas

Levantamento read-only na origem (`public`):

- Total de tabelas: **196**
- Tabelas com dados: **25**
- Tabelas vazias: **171**
- Tabelas com RLS ativo: **196**
- FKs de `public` para schemas nao-publicos: **nao identificadas** (somente dependencias dentro de `public` no inventario de FKs)

Principais tabelas com dados (top volume):

- `role_module_permissions` (124)
- `product_subgroups` (53)
- `product_groups` (21)
- `system_modules` (20)
- `proposal_access_logs` (13)
- `report_definitions` (13)
- `product_types` (12)
- `product_classes` (10)
- `crm_activity_weights` (9)
- `lead_sources` (9)
- `lost_reason_categories` (9)
- `transicao_tributaria_parametros` (9)
- `order_approval_rules` (8)
- `cadastro_imposto_seletivo` (7)
- `pipeline_stages`, `product_families`, `product_unit_measures` (6 cada)
- `tenants`, `pipelines`, `system_settings`, `license_settings`, `erp_sequences`, `regras_tributacao` (1 cada)

Exemplos de tabelas criticas atualmente vazias na origem:

- `legal_entities`, `profiles`, `user_tenants`, `user_roles`
- `companies`, `contacts`, `products`
- `deals`, `proposals`, `proposal_items`
- `orders`, `order_items`, `sales_reps`
- `notifications`, `tasks`

## 6. Classificacao por dominio

### 6.1 Nucleo multi-tenant

- `tenants` (com dados)
- `legal_entities`, `profiles`, `user_tenants`, `user_roles` (vazias)
- outras tabelas de vinculacao/permissao relacionadas a usuarios aparecem no inventario, majoritariamente vazias.

### 6.2 Cadastros

- `companies`, `contacts`, `products`, `carriers` (vazias)
- cadastros auxiliares tributarios e de produto com dados pontuais (`product_groups`, `product_subgroups`, `product_types`, `product_classes`, `product_families`, `product_unit_measures`, `cadastro_imposto_seletivo`, `regras_tributacao`).

### 6.3 Comercial

- `deals`, `proposals`, `proposal_items`, `orders`, `order_items`, `sales_reps` (vazias)
- `proposal_access_logs` com dados de teste operacional.
- `portfolios` e `product_versions` nao aparecem como tabela base no inventario desta origem.

### 6.4 Operacional/sistema

- Varias tabelas tecnicas de log/fila/auditoria identificadas (ex.: `audit_logs`, `*_log`, `*_queue`, `*_sync_*`, `request_logs`), em geral vazias.
- `system_modules` e `system_settings` com dados.

### 6.5 BI/relatorios

- Presenca de tabelas/filas BI (`_bi_phase0_snapshot_*`, `bi_sales_fact`, `bi_sales_fact_queue`, `report_definitions`, `report_snapshots`).
- Dados efetivos concentrados em `report_definitions`.

### 6.6 Storage/Auth

- Dependencias de dados de aplicacao para `storage`/`auth` devem ser tratadas via fluxo proprio (Storage/Auth), nao por copia manual de tabelas de sistema.
- Inventario de FKs de `public` nao mostrou dependencia FK direta para schemas externos.
- Reconciliacao funcional de `auth users` vs `profiles` deve ser criterio obrigatorio no piloto.

## 7. Ordem proposta de migracao

Ordem-base por dependencia (ajustar no cutover real conforme checagem FK final):

1. Extensoes e objetos auxiliares.
2. `tenants`.
3. `legal_entities`.
4. `profiles` + vinculacoes de usuario (`user_tenants`, `user_roles`, correlatas).
5. Permissoes e modulos (`system_modules`, mapeamentos de permissao).
6. Cadastros mestres (familias/tipos/classes/grupos/subgrupos/produtos base).
7. `sales_reps` e estruturas de carteira.
8. `companies` e `contacts`.
9. Configuracoes de pipeline e regras comerciais.
10. `deals`.
11. `proposals` e `proposal_items`.
12. `orders` e `order_items`.
13. `tasks`, `notifications` e demais tabelas operacionais de negocio.
14. Logs/filas tecnicas (decisao explicita: migrar, truncar ou reinicializar por ambiente).
15. BI/facts/snapshots (preferencia por recomputar quando possivel).
16. Storage (buckets/objetos) em etapa dedicada.
17. Segredos/configuracoes e validacao final de Edge Functions.

## 8. Criterios de reconciliacao

Para cada grupo migrado:

- Contagem origem x destino por tabela.
- Amostragem de IDs chave (PKs) por tabela critica.
- Validacao de integridade referencial (FKs orfas).
- Checagem de RLS e politicas ativas no destino.
- Validacao de papeis/permissoes de acesso (RBAC).
- Validacao `auth users` x `profiles` x vinculos de tenant.
- Validacao de storage (buckets esperados + contagem de objetos).
- Validacao funcional minima por fluxo critico (comercial, proposta, pedido).
- Registro de divergencias com criterio de aceite/rejeicao.

## 9. Riscos e bloqueios

- Origem analisada (staging) possui volume baixo e muitas tabelas criticas vazias; pode nao representar producao.
- Divergencia entre "tabela existente" e "tabela com dados" para dominios comerciais centrais.
- Dependencias de logs/filas/sync podem contaminar cutover se migradas sem filtro.
- FKs circulares e ordem de carga podem exigir estrategia de constraints/triggers.
- `secrets list` ainda pendente por autenticacao CLI.
- Storage/Auth exigem trilha dedicada de reconciliacao.
- Integracoes externas e homologacao funcional completa ainda pendentes no Go/No-Go geral.

## 10. Pendencias

1. Definir origem real de dados para piloto representativo (staging atual ou snapshot mais fiel de producao).
2. Resolver inventario operacional de nomes de secrets (`supabase login`/token fora do repo).
3. Definir politica para migracao de logs/filas/auditoria (incluir, excluir, ou reset controlado).
4. Preparar checklist de reconciliacao funcional por area de negocio.
5. Consolidar playbook de migracao com janelas, rollback e criterio de abort.

## 11. Recomendacao Go/No-Go

**NO-GO para migracao real de producao nesta fase.**

Motivo:

- A fase entrega planejamento tecnico consistente, mas a base analisada tem baixo volume de dados de negocio e nao valida reconciliacao real de producao.
- Ainda faltam homologacoes de dados reais, integracoes e cutover operacional completo.

## 12. Proximo passo recomendado

- Executar um **piloto controlado de migracao/reconciliacao** em ambiente isolado com dataset mais representativo (ou recorte controlado de producao anonimizado), aplicando os criterios deste plano.
- Apos o piloto, consolidar runbook de cutover e criterios formais de Go/No-Go para as fases seguintes.
