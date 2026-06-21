# Pilot Seed Scripts (Fase 17A)

## Status atual dos scripts

- `seed-pilot-dataset.sql`: pronto para execucao futura controlada, com hard-stop e idempotencia.
- `validate-pilot-dataset.sql`: read-only, sem escrita.
- `reconcile-pilot-dataset.sql`: read-only, sem escrita.
- `cleanup-pilot-dataset.sql`: limpeza logica com preview e gate de execucao.
- Nenhum script foi executado nesta fase.

## Objetivo

Montar e validar um dataset sintetico/controlado para piloto tecnico de migracao/reconciliacao, sem uso de dados reais e sem integracoes externas reais.

## Ambiente autorizado (futuro)

- Nome esperado: `crm-qualyvac-restore-test`
- Project ref esperado: `nsnmlleplpzsefzkuxlb`

## Ambientes proibidos

- Staging (proibido): `cansbrrwrprcycjvgvqm`
- Producao: qualquer ref nao explicitamente autorizado

## Pre-requisitos para execucao futura

- Aprovacao explicita de Felipe Duarte para janela de execucao.
- Confirmacao manual do ambiente isolado antes de rodar qualquer SQL.
- Configuracao dos settings obrigatorios na mesma sessao SQL.
- Proibido executar com `service_role` no contexto desta fase.

## Settings obrigatorias (sem secrets)

Antes de `seed-pilot-dataset.sql`:

```sql
set app.pilot_target_ref = 'nsnmlleplpzsefzkuxlb';
set app.pilot_target_name = 'crm-qualyvac-restore-test';
set app.pilot_execution_approved = 'YES';
```

Antes de `cleanup-pilot-dataset.sql` (alem das acima):

```sql
set app.pilot_cleanup_execute = 'NO'; -- preview
-- alterar para YES somente com aprovacao explicita:
-- set app.pilot_cleanup_execute = 'YES';
```

## Ordem sugerida de execucao futura

1. `seed-pilot-dataset.sql`
2. `validate-pilot-dataset.sql`
3. `reconcile-pilot-dataset.sql`
4. `cleanup-pilot-dataset.sql` (somente quando aprovado e necessario)

## Hard-stop obrigatorio

Os scripts abortam quando:

- `app.pilot_target_ref` nao existe ou diverge de `nsnmlleplpzsefzkuxlb`
- `app.pilot_target_ref` e `cansbrrwrprcycjvgvqm` (staging)
- `app.pilot_target_name` nao existe ou diverge de `crm-qualyvac-restore-test`
- `app.pilot_execution_approved` nao existe ou nao e `YES`
- no cleanup, `app.pilot_cleanup_execute` nao e `YES` (fica em preview)

## Namespace e idempotencia

- Namespace/prefixo oficial: `PILOTO_MIGRACAO_20260621`
- Slug de tenant piloto: `piloto-migracao-20260621`
- Prefixos de rastreio: `CLIENTE PILOTO`, `CONTATO PILOTO`, `PIL-SKU-`, `PROP-PIL-`, `ORD-PIL-`, `TASK PILOTO_MIGRACAO_20260621`, `Notif PILOTO_MIGRACAO_20260621`
- Insercoes com `where not exists` para evitar duplicidade
- Sem sobrescrever registros fora do namespace piloto

## Politica de auth/users (Fase 17A)

- Nao criar `auth.users` neste script.
- Nao usar emails reais; apenas identificadores sinteticos `@example.test`.
- `profiles` e `user_tenants` so aproveitam usuarios sinteticos preexistentes em `auth.users`.
- `user_roles` esta fora de escopo da Fase 17A (RBAC definitivo pendente); sem insert forcado.
- Trilha de criacao real de auth fica separada e aprovada em fase propria.

## Politica de logs/filas/auditoria

- Logs reais: fora do piloto.
- Filas reais: fora do piloto.
- Auditoria real: fora do piloto.
- Registros sinteticos apenas se forem inertes e identificados por namespace.
- Validacoes/reconciliacao usam checagens heuristicas tolerantes a ausencia de tabelas de fila.

## Politica de storage

- Nao criar objetos reais de storage nesta fase.
- Nao fazer upload/download real nesta fase.
- Metadata de storage fica como escopo futuro (fora da Fase 17A), salvo validacoes read-only quando aplicavel.

## Politica de integracoes

- Proibido disparar ERP/PDF/CNPJ/n8n/webhooks reais.
- Usar apenas estados seguros para evitar sincronizacao externa.
- No seed atual:
  - propostas: `rascunho` e `recusada` (enum real `proposal_status`)
  - pedidos: `pendente` e `em_producao` (enum real `order_status`)
- Se alguma integracao depender de campo sem opcao segura, bloquear execucao e tratar em trilha separada.

## Politica de cleanup

- Nunca usar `truncate`.
- Sempre executar preview/contagens antes.
- Deletar somente registros do namespace piloto.
- Delecao em ordem inversa de dependencia.
- Cleanup somente com `app.pilot_cleanup_execute = 'YES'` e aprovacao explicita.

## Criterios de aprovacao

- Execucao apenas no alvo autorizado.
- Hard-stop validado com settings obrigatorios.
- Dataset piloto criado sem duplicidade indevida.
- Sem FK orfa critica no reconciliador.
- Sem integracao externa real disparada.
- Sem dado real/sensivel versionado ou inserido.
- Cleanup seguro disponivel e rastreavel por prefixo/namespace.

## Criterios de reprovacao

- Ambiente alvo incorreto ou nao isolado.
- Ausencia/divergencia de settings obrigatorias.
- Evidencia de gatilho de integracao externa real.
- Qualquer dado real/sensivel no fluxo.
- Divergencias criticas sem justificativa.
- Risco de cleanup afetar dados fora do piloto.

## Licoes da Fase 19B

- Seed falhou por dependencia tecnica de `hstore` na funcao de trigger `enforce_uppercase_text()`.
- Reconcile falhou por uso de valor invalido de enum em `proposal_status` (`draft`).
- Controles de seguranca funcionaram: target correto, staging/producao nao usados.
- Cleanup nao foi executado (nao autorizado).
- Contagens do namespace piloto permaneceram em zero apos a tentativa parcial.
- Ajustes aplicados na Fase 19C:
  - validacao tecnica explicita de `hstore` no hard-stop do seed;
  - normalizacao de textos para uppercase em colunas cobertas por `enforce_uppercase_text()`;
  - substituicao de status para enums reais (`proposal_status` e `order_status`);
  - validacoes/reconciliacao/cleanup ajustadas para filtros case-insensitive do namespace piloto.
- Nova execucao somente em Fase 19D, mediante aprovacao explicita de Felipe Duarte.

## Licoes da Fase 19D-D

- Seed avancou apos habilitacao controlada de `hstore` no restore-test.
- Nova falha foi regra real de transportadora: `Codigo ERP e obrigatorio para transportadora`.
- Regra associada: trigger/funcao `validate_carrier_erp_code()`.
- Contagens principais permaneceram em zero e filas permaneceram zeradas.
- Cleanup nao foi executado.
- Ajuste aplicado na Fase 19E:
  - carriers piloto passam a incluir `erp_code` sintetico obrigatorio (`999001` e `999002`);
  - validate/reconcile/cleanup foram alinhados para conferir/filtrar carriers piloto com ERP code sintetico.
- Nova execucao deve ocorrer em fase dedicada, com aprovacao explicita de Felipe Duarte.

## Licoes da Fase 19G

- Seed avancou apos correcoes de `hstore` e ERP code de transportadoras.
- Nova falha foi restricao de unicidade tecnica em `products`: `idx_products_technical_uniqueness`.
- Contagens principais permaneceram em zero e filas permaneceram zeradas.
- Cleanup nao foi executado.
- Ajuste aplicado na Fase 19H:
  - `seed-pilot-dataset.sql` passou a gerar `nome_impresso` sintetico e unico por produto piloto;
  - idempotencia de products foi alinhada a mesma composicao tecnica do indice unico (com `active = true`).
  - `validate/reconcile/cleanup` foram ajustados para rastrear products pelo padrao tecnico piloto (`PIL-SKU-%` + `PILOTO IMPRESSO %`).
- Nova execucao so pode ocorrer em fase dedicada, com aprovacao explicita de Felipe Duarte.

## Licoes da Fase 19I

- Seed iniciou no target isolado e abortou por incompatibilidade estrutural em `proposals`.
- Erro encontrado: `column "sales_rep_id" of relation "proposals" does not exist`.
- Causa: o `seed-pilot-dataset.sql` ainda tentava inserir `sales_rep_id` em `public.proposals`, mas o schema real do target nao possui essa coluna.
- Impacto: nenhuma linha piloto persistida; contagens principais e filas permaneceram em zero.
- Cleanup nao foi executado.
- Correcao aplicada na Fase 19J:
  - remover `sales_rep_id` apenas do bloco de insert de `proposals`, mantendo o menor ajuste compativel com o schema real.
- Nova execucao deve ocorrer somente em fase dedicada e com aprovacao explicita de Felipe Duarte.

## Licoes da Fase 19K

- Seed iniciou no target isolado e abortou por incompatibilidade de tipagem em `proposals.status`.
- Erro encontrado: `column "status" is of type proposal_status but expression is of type text`.
- Causa provavel: o valor de status vinha de CTE textual (`sm.status`) sem cast explicito para o enum real.
- Impacto operacional da 19K:
  - seed abortado;
  - validate/reconcile nao executados;
  - contagens e filas permaneceram zeradas;
  - cleanup nao executado;
  - staging/producao intocados.
- Correcao aplicada na Fase 19L:
  - cast explicito no seed para `proposal_status` em `public.proposals.status`;
  - ajuste preventivo equivalente para `orders.status` com `::order_status`;
  - sem qualquer alteracao de schema/tipos no banco.
- Nova execucao deve ocorrer somente em fase dedicada e com aprovacao explicita de Felipe Duarte.

## Licoes da Fase 19M/19O

- Seed da 19M iniciou e abortou ao inserir em `orders`.
- Erro encontrado: `type "activity_status" does not exist`.
- Diagnostico read-only (19N/19O):
  - trigger `trg_promote_to_customer_on_order` (AFTER INSERT em `orders`) chama funcao homonima;
  - a funcao fazia cast para tipo inexistente (`'ativo'::activity_status`);
  - no schema real do target, `public.companies.activity_status` e `text`;
  - nao existe `CREATE TYPE activity_status` no historico de migrations.
- Correcao preparada na Fase 19P (somente repo):
  - migration de compatibilidade para alinhar funcoes lifecycle ao tipo `text`;
  - remove casts `::activity_status` de funcoes ativas (`trg_promote_to_customer_on_order`, `recompute_company_lifecycle`, `flag_lost_customers_for_release`);
  - sem criar enum/type, sem alterar coluna, sem remover/desabilitar trigger.
- A migration foi apenas versionada e **nao aplicada** nesta fase.

## Licoes da Fase 19R/19S

- Seed da 19R iniciou e abortou ao inserir em `tasks`.
- Erro encontrado: `null value in column "user_id" of relation "access_violation_log" violates not-null constraint`.
- Diagnostico read-only (19S):
  - a trigger `check_task_owner_consistency_trigger` esta ativa em `public.tasks` (`BEFORE INSERT OR UPDATE`);
  - a funcao `public.check_task_owner_consistency()` usa `auth.uid()` para validacao e para inserir log de violacao;
  - em contexto tecnico/seed, `auth.uid()` fica `NULL`;
  - `public.access_violation_log.user_id` e `uuid NOT NULL`, sem default.
- Impacto:
  - incompatibilidade da funcao em execucao tecnica sem usuario autenticado;
  - seed abortado por tentativa de inserir `user_id = NULL` no log.
- Decisao:
  - **nao** enfraquecer seed com workaround;
  - preparar correcao estrutural versionada na Fase 19T, mantendo seguranca para usuarios autenticados.
- Correcao preparada na Fase 19T (somente repo):
  - migration de compatibilidade para `check_task_owner_consistency()` com retorno antecipado quando `auth.uid() IS NULL`;
  - regras para usuarios autenticados preservadas (validacao de carteira + log de violacao);
  - sem alteracao de tabela/trigger/RLS/policies.
- A migration foi apenas versionada e **nao aplicada** nesta fase.

## Licoes da Fase 19V/19W

- A Fase 19V foi o primeiro ciclo tecnico com `seed + validate + reconcile` concluindo sem erro estrutural no target isolado.
- O valor `notifications=0` observado na 19V foi diagnosticado na 19W como comportamento condicional, nao falha estrutural:
  - o bloco de notifications do seed existe, mas depende de `public.profiles` com usuarios piloto;
  - quando `pilot_profiles_total=0`, o insert de notifications fica naturalmente sem linhas;
  - por isso, validate/reconcile passaram a tratar notifications com expectativa condicional (profiles presentes => 5; profiles ausentes => 0).
- O valor `product_sync_queue=20` foi diagnosticado na 19W como comportamento esperado:
  - os 20 produtos piloto acionam trigger de enqueue em `products`;
  - o resultado esperado nesta trilha e 1:1 (20 filas pendentes para 20 produtos piloto), sem drenagem.
- O drainer de filas **nao** faz parte desta trilha de seed piloto controlado.
- Cleanup permanece proibido ate fechamento da validacao final e aprovacao explicita.
- A Fase 19X faz apenas alinhamento estatico de validate/reconcile/documentacao, sem escrita em banco.

## Licoes da Fase 20D

- O cleanup controlado da 20D foi concluido com sucesso no target isolado, com contagens finais piloto zeradas.
- O script oficial anterior apresentou bloqueio de FK em `profiles.active_legal_entity_id` quando havia vinculo tecnico apontando para legal entity piloto.
- O script oficial anterior nao removia auxiliares de produto criados pelo seed (`product_groups`, `product_subgroups`, `product_types`), causando bloqueio na remocao de tenant piloto.
- A 20D foi destravada operacionalmente com cleanup suplementar estritamente filtrado por escopo piloto.
- A Fase 20E incorpora essas lacunas no `cleanup-pilot-dataset.sql`:
  - desassociacao segura de `profiles.active_tenant_id`/`active_legal_entity_id` quando referenciam tenant/legal entities piloto;
  - remocao de vinculos `user_tenants`/`user_legal_entities` no escopo piloto;
  - remocao dos auxiliares de produto piloto com filtro por tenant e labels de namespace.
- O gate obrigatorio de cleanup permanece: `app.pilot_cleanup_execute = 'YES'`.
- O cleanup continua restrito ao target isolado autorizado; staging/producao seguem proibidos sem fase dedicada e aprovacao explicita.

## Aviso critico

Nao executar estes scripts sem aprovacao explicita de Felipe Duarte.
Nao executar em staging/producao.
