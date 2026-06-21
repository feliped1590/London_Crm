# Fase 15 - Desenho detalhado do dataset piloto sintetico/controlado

## 1. Objetivo

Detalhar o dataset piloto sintetico/controlado que sera usado na fase de execucao do piloto tecnico de migracao/reconciliacao, sem executar carga de dados nesta fase.

## 2. Contexto

- Fase 12: trilha de backup/restore validada com evidencia auditavel e restore test em ambiente isolado (`APROVADO COM RESSALVA`).
- Fase 13: plano de migracao/reconciliacao indicou `NO-GO` para migracao real devido baixa representatividade do staging.
- Fase 14: estrategia recomendada para piloto foi a Opcao B (dataset sintetico/controlado representativo), mantendo `NO-GO` para cutover real.

## 3. Ambientes envolvidos

- Origem base para modelagem e validacao de estrutura (read-only): `crm-qualyvac-staging` (`cansbrrwrprcycjvgvqm`).
- Destino isolado para execucao do piloto: `crm-qualyvac-restore-test` (`nsnmlleplpzsefzkuxlb`).
- Producao: fora de escopo.

## 4. Restricoes de seguranca

- Sem deploy, sem migracao executada, sem restore executado nesta fase.
- Sem escrita em banco (insert/update/delete/truncate).
- Sem alteracao de codigo funcional, schema, migrations, RLS/policies, UI ou Edge Functions.
- Sem versionamento de dumps, manifestos sensiveis, tokens, secrets ou dados pessoais.

## 5. Dependencias reais identificadas

Resumo read-only das tabelas criticas mapeadas:

- `tenants` e `legal_entities` sao base para grande parte das FKs de dominio.
- `profiles` depende de `tenants`/`legal_entities` (campos ativos) e referencia por `user_id`.
- `user_tenants` depende de `tenants`; `user_roles` depende de `user_id`.
- `role_module_permissions` depende de `system_modules`; tabela `roles` nao existe como base `public` no inventario atual.
- `companies` depende de `tenants`, `legal_entities`, `sales_reps`, `carriers` e cadastros auxiliares.
- `contacts` depende de `companies` e `tenants`.
- `products` depende de `tenants`, `legal_entities` e cadastros auxiliares (`product_groups`, `product_subgroups`, `product_types` etc.).
- `deals` depende de `tenants`, `legal_entities`, `companies`, `contacts`, `pipelines`, `pipeline_stages`.
- `proposals` depende de `deals`, `companies`, `contacts`, `legal_entities`, `sales_reps`, `carriers`, `tenants`.
- `proposal_items` depende de `proposals` e `products`.
- `orders` depende de `proposals`, `deals`, `companies`, `contacts`, `legal_entities`, `sales_reps`, `carriers`, `tenants`.
- `order_items` depende de `orders`, `products`, `tenants`.
- `tasks` depende de `tenants` e pode depender de `companies`/`contacts`/`deals`.
- `notifications` depende de `user_id` e usa contexto de tenant.
- `proposal_access_logs` depende de `proposals`.

Estado atual de representatividade (origem staging):

- Tabelas criticas existentes porem vazias: `legal_entities`, `profiles`, `user_tenants`, `user_roles`, `companies`, `contacts`, `products`, `deals`, `proposals`, `proposal_items`, `orders`, `order_items`, `sales_reps`, `notifications`, `tasks`.
- Com dados relevantes para base de piloto: `tenants` (1), `system_modules` (20), `role_module_permissions` (124), `product_groups` (21), `product_subgroups` (53), `product_types` (12), `proposal_access_logs` (13).
- `product_versions`, `portfolios`, `roles` nao aparecem como tabela base `public` no inventario atual.
- Metadata de plataforma: `auth.users` (0), `storage.buckets` (9), `storage.objects` (0).

## 6. Dataset sintetico proposto

### 6.1 Nucleo

- 1 tenant sintetico: `Tenant Piloto Migracao`.
- 2 legal entities sinteticas: `Empresa Piloto A` e `Empresa Piloto B`.
- 3 usuarios sinteticos: administrador, vendedor, assistente.
- 2 perfis de permissao: admin e comercial/operacao.
- Vinculos obrigatorios: usuario->tenant, usuario->perfil/permissao, usuario->legal entity ativa.

### 6.2 Cadastros

- 20 empresas/clientes sinteticos.
- 20 contatos sinteticos vinculados a empresas.
- 20 produtos sinteticos.
- Reuso de cadastros auxiliares existentes quando possivel (`product_groups`, `product_subgroups`, `product_types`).
- 2 carriers sinteticas/controladas (se tabela disponivel para carga no piloto).

### 6.3 Comercial

- 10 deals sinteticos em multiplos estagios.
- Propostas com status variados (`draft`, `approved`, `rejected`, `converted`).
- Pedidos com status variados (`draft`, `pending`, `approved`, status tecnico de sincronizacao apenas em simulacao controlada).
- Itens completos em propostas e pedidos.
- Pelo menos 2 vendedores sinteticos vinculados.

### 6.4 Operacional

- 5 tasks sinteticas.
- 5 notifications sinteticas.
- Logs/filas somente conforme politica explicita do piloto.
- `proposal_access_logs` preferencialmente fora do escopo principal de carga; incluir apenas se teste especifico exigir.

### 6.5 Integracoes e storage

- Integracoes externas em modo nao-disparo (simuladas/flag de teste).
- Storage: 1 bucket de teste (se permitido pela estrategia da fase de execucao) e 2-3 objetos sinteticos pequenos, sem conteudo sensivel.

## 7. Tabelas/dominios incluidos

- Nucleo: `tenants`, `legal_entities`, `profiles`, `user_tenants`, `user_roles`, `system_modules`, `role_module_permissions`.
- Cadastros: `companies`, `contacts`, `products`, `product_groups`, `product_subgroups`, `product_types`, `carriers`.
- Comercial: `sales_reps`, `deals`, `proposals`, `proposal_items`, `orders`, `order_items`.
- Operacional minimo: `tasks`, `notifications`.
- Storage metadata/objetos de teste (escopo controlado da execucao do piloto).

## 8. Tabelas/dominios excluidos

- `roles` (nao identificada como tabela base `public` no inventario atual).
- `product_versions` e `portfolios` (nao identificadas como tabela base `public` no inventario atual).
- Tabelas de BI/facts/snapshots para decisao de cutover.
- Carga manual de schemas de sistema (`auth`, `storage`) fora da trilha dedicada.
- Secrets/tokens/chaves/configuracoes sensiveis.

## 9. Itens dependentes de decisao

1. Politica final para logs/filas/auditoria (incluir, sintetizar, manter vazio ou excluir).
2. Estrategia de auth users no piloto (sincronizacao `auth.users` x `profiles`).
3. Escopo exato de storage (somente metadata ou metadata + objetos de teste).
4. Regras para simular integracoes (ERP/PDF/CNPJ) sem chamadas reais.
5. Resolucao de `secrets list` para completar inventario operacional de segredos.

## 10. Ordem de criacao/carga

Ordem proposta para fase de execucao do piloto (ajustada por FKs reais):

1. `tenants`
2. `legal_entities`
3. `system_modules` (reuso) e `role_module_permissions` (ajustes controlados de piloto, se necessario)
4. `profiles` (com vinculos ativos de tenant/legal entity)
5. `user_tenants`
6. `user_roles`
7. Cadastros auxiliares de produto (`product_groups`, `product_subgroups`, `product_types`) - preferir reuso existente
8. `carriers`
9. `sales_reps`
10. `companies`
11. `contacts`
12. `products`
13. Pipeline/configuracoes minimas (quando exigido para `deals`)
14. `deals`
15. `proposals`
16. `proposal_items`
17. `orders`
18. `order_items`
19. `tasks`
20. `notifications`
21. Storage de teste (bucket/objetos sinteticos), se habilitado
22. Logs/filas somente conforme decisao explicita

## 11. Politica de logs/filas/auditoria

Classificacao proposta para o piloto:

- `proposal_access_logs`: **excluir do escopo principal**, incluir somente em caso de teste dedicado.
- Integration queues/sync logs (`*_queue`, `*_sync_*`): **manter vazio** por padrao; usar sintetico apenas com regra de nao-disparo.
- `audit_logs`: **gerar sintetico minimo** somente se necessario para validar trilha de auditoria.
- PDF jobs: **excluir** da carga inicial, manter simulacao funcional sem disparo externo.
- BI facts/snapshots: **excluir** do piloto de migracao core.
- `notifications` e `tasks`: **incluir** com volume minimo funcional controlado.

## 12. Criterios de reconciliacao

### Nucleo

- Contagem de `tenants`, `legal_entities`, `profiles`, `user_tenants`, `user_roles`.
- Consistencia de vinculos usuario<->tenant e usuario<->permissao.
- Validacao de acesso por RLS e perfil.

### Cadastros

- Contagem de `companies`, `contacts`, `products`, `carriers`.
- Zero FK orfa entre empresa-contato-produto e entidades base.
- Validacao funcional de listagem/filtro por tenant/legal entity.

### Comercial

- Contagem de `deals`, `proposals`, `proposal_items`, `orders`, `order_items`, `sales_reps`.
- Preservacao de status planejados.
- Vinculos corretos de itens e entidades comerciais.
- Checagem basica de coerencia de totais.

### Operacional

- Contagem e visibilidade correta de `tasks` e `notifications` por perfil.
- Confirmar que logs/filas seguem politica definida (sem disparo indevido).

### Storage/Auth

- Bucket/objetos de teste presentes (quando no escopo).
- Checagem de nao exposicao publica indevida.
- Validacao de coerencia `auth users` x `profiles` no escopo do piloto.

## 13. Criterios de aprovacao

- 100% dos registros sinteticos obrigatorios criados no escopo.
- 100% de reconciliacao nas tabelas criticas (ou divergencia explicada e aprovada).
- Zero FK orfa critica.
- Zero erro critico de RLS/permissao nos fluxos homologados.
- Fluxos de cliente/produto/deal/proposta/pedido operacionais no piloto.
- Nenhuma integracao externa disparada sem autorizacao.
- Nenhum dado sensivel exposto.
- Nenhum impacto em staging/producao.

## 14. Criterios de reprovacao

- Divergencia sem explicacao em tabela critica.
- FK orfa em entidade comercial.
- Acesso indevido de usuario (quebra de RLS/RBAC).
- Proposta/pedido inacessivel ou inconsistente.
- Storage quebrado no escopo de teste.
- Disparo indevido de integracao externa.
- Necessidade de ajuste estrutural nao previsto/documentado.

## 15. Riscos e bloqueios

- Dependencias circulares e ordem de carga podem exigir ajustes de sequenciamento.
- Ausencia de algumas tabelas esperadas (`roles`, `product_versions`, `portfolios`) exige decisao de escopo.
- Pendencia de inventario de secrets limita validacao completa de configuracao operacional.
- Integracoes externas ainda podem introduzir risco de efeito colateral se mal isoladas.
- Dataset sintetico pode nao cobrir 100% dos cenarios de producao (mitigado por piloto final opcao C).

## 16. Recomendacao final

**GO para script/seed do dataset piloto (com ressalvas operacionais).**

Ressalvas:

- Concluir decisoes pendentes (logs/filas, auth/storage, integracoes simuladas).
- Executar piloto apenas em ambiente isolado.
- Manter `NO-GO` para cutover real ate validacao completa dos gates subsequentes.

## 17. Proximo passo recomendado

Preparar a fase de execucao do piloto com:

1. especificacao de script/seed controlado por dominio;
2. checklist de hard-stop de ambiente (origem/alvo);
3. checklist de reconciliacao automatizavel (contagens/FKs/RLS);
4. matriz de aprovacao/reprovacao com evidencias obrigatorias.
