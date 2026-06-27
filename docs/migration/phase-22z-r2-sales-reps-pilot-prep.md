# Fase 22Z-R2 — Preparacao do piloto `sales_reps` (sem escrita)

## 1. Objetivo

Preparar tecnicamente o piloto de escrita futura para `sales_reps` no restore-test, sem executar qualquer escrita nesta fase.

## 2. Escopo

- pre-check Git e validacao de estado do marco;
- leitura obrigatoria de documentos/evidencias da trilha 22T/22U/22Y;
- validacao de presenca de `sales_reps` no input e write plan;
- validacao read-only de schema, constraints e dependencias reais;
- definicao de chave idempotente proposta, payload minimo, gate humano e contrato de evidencias before/after;
- sem alteracao de executor e sem execucao de comando de escrita.

## 3. Restricoes absolutas

- sem escrita em banco;
- sem SQL de escrita (`insert/update/upsert/delete`);
- sem RPC de escrita;
- sem seed/cleanup/rollback;
- sem migration/deploy;
- sem ERP/API/webhook/n8n;
- sem filas;
- sem piloto real de `sales_reps`;
- sem liberar escrita ampliada;
- sem alterar executor para executar `sales_reps`;
- sem commit e sem push.

## 4. Estado atual do marco

Pre-check Git executado:

- branch atual: `main`;
- `git status --short`: `?? docs/migration/phase-22y-r2-next-pilot-selection.md` (pendencia esperada da 22Y-R2);
- divergencia `origin/main...main`: `0 0`;
- ultimo commit: `61f3677f feat(migration): add controlled baseline write pilot`.

Validacao de conformidade do pre-check:

- sem arquivos inesperados alem do arquivo da 22Y-R2;
- condicao de continuidade atendida.

Arquivos obrigatorios lidos:

- `docs/migration/phase-22y-r2-next-pilot-selection.md`
- `docs/migration/phase-22t-r2-pilot-legal-entities-write.md`
- `docs/migration/phase-22u-r2-post-pilot-audit.md`
- `scripts/migration/phase-22k-r2-baseline-write.mjs`
- `artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json`
- `artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-224906.json` (mais recente)
- `artifacts/migration/phase-22u-r2-post-pilot-audit/post-pilot-audit-20260626-225314.json` (arquivo unico)

## 5. Presenca de `sales_reps` no input/write plan

Confirmacoes:

- `sales_reps` presente em `baseline_entities` do input (`latest.json`);
- `sales_reps` presente em `simulated_records_count` do input;
- `sales_reps` presente em `eligibleEntitiesForWrite` do write plan;
- `sales_reps` presente na ordem planejada (`plannedWriteOrder`);
- `sales_reps` presente na whitelist futura do executor (`ALLOWED_ENTITIES` e `FIRST_ROUND_EXECUTABLE_ENTITIES_22Q`);
- `sales_reps` nao esta em `BLOCKED_ENTITIES`;
- write plan confirma `queueEntitiesWillNotBeWritten=true` e `externalIntegrationsWillNotBeCalled=true`;
- `sales_reps` nao depende de `profiles` para cadastro basico no schema atual.

## 6. Contagem planejada

- contagem planejada de `sales_reps` no input: `2`;
- contagem planejada de `sales_reps` no write plan: `2`;
- contagem atual observada em banco (read-only): `0`.

## 7. Dependencias

Validacao read-only do schema real de `public.sales_reps`:

- colunas relevantes: `id`, `name`, `type`, `phone`, `email`, `active`, `tenant_id`, `created_at`, `erp_vendor_code`;
- obrigatorias (NOT NULL): `id`, `name`, `tenant_id`;
- opcionais: `erp_vendor_code`, `email`, `active`, `type`, `phone`;
- FK existente: `sales_reps_tenant_id_fkey` (`tenant_id -> tenants.id`);
- PK: `sales_reps_pkey` (`id`).

Dependencias avaliadas para piloto:

- `tenant_id`: obrigatorio e dependencia primaria;
- `legal_entity_id`: nao existe no schema atual de `sales_reps`;
- campos de usuario (`user_id`, `profile_id`): nao existem no schema atual de `sales_reps`;
- codigo ERP (`erp_vendor_code`): existe, mas opcional;
- nome (`name`): obrigatorio;
- status (`active`): opcional.

Relacao com piloto 22T-R2 (`legal_entities`):

- no schema atual, `sales_reps` nao referencia `legal_entities` por FK;
- portanto, o registro criado em `legal_entities` na 22T-R2 nao e dependencia tecnica obrigatoria para inserir `sales_reps`;
- dependencia operacional permanece indireta (coerencia de contexto de tenant e baseline).

## 8. Chave idempotente proposta

Chave priorizada para futura escrita:

- **proposta:** `tenant_id + erp_vendor_code`.

Status da validacao:

- nao existe constraint unica no banco para `tenant_id + erp_vendor_code`;
- `erp_vendor_code` e opcional (`is_nullable=YES`);
- apenas indice nao unico em `erp_vendor_code` foi encontrado;
- `latest.json` confirma mapeamento de campo, mas nao traz payload linha-a-linha para comprovar preenchimento em todos os 2 registros planejados.

Conclusao de idempotencia:

- chave proposta e conceitualmente adequada, mas **ainda nao garantida por constraint**;
- sem regra adicional documentada para casos com `erp_vendor_code` ausente, nao e seguro avancar para execucao real.

## 9. Validacao de schema/constraints

Achados objetivos (read-only):

- constraints em `sales_reps`: apenas PK e FK de `tenant_id`;
- inexistencia de constraint unica de negocio para `erp_vendor_code` por tenant;
- tipo de `erp_vendor_code` no schema atual: `integer`;
- nao ha indicio de transacional, fila, ERP/API/webhook/n8n atrelado a tabela no escopo desta fase.

Risco adicional de compatibilidade:

- especificacao antiga da 22F-R2 descreve exemplos de ERP code textual (`SR-ERP-001`, `SR-ERP-002`), enquanto o schema atual usa `integer`;
- requer alinhamento de contrato de dados antes de qualquer execucao futura.

## 10. Payload minimo permitido (futuro)

Payload minimo proposto para futura escrita piloto de `sales_reps`:

- `tenant_id` (obrigatorio);
- `name` (obrigatorio);
- `erp_vendor_code` (obrigatorio para piloto seguro, apesar de opcional no schema);
- `email` (somente se presente e validado no input);
- `active` (somente se presente no input; fallback conservador definido previamente);
- `type` (somente se mapeado explicitamente no input e validado).

Observacoes:

- nao usar colunas fora do contrato minimo;
- nao incluir qualquer chave de usuario (`user_id`, `profile_id`) nesta escrita piloto.

## 11. Campos proibidos

Ficam proibidos no piloto de `sales_reps`:

- senha, hash, token, credencial, auth/sessao;
- qualquer campo de permissao/perfil;
- qualquer vinculo `user_*` (`user_tenants`, `user_legal_entities`, `user_sales_reps`);
- qualquer campo de `profiles`;
- qualquer campo nao mapeado e nao validado;
- qualquer tentativa de escrita em `company_contacts` ou entidades transacionais.

## 12. Gate humano especifico

Frase obrigatoria para futura fase de execucao (somente documentada aqui):

`AUTORIZO A SEGUNDA ESCRITA PILOTO DA BASELINE 22Z-R2 SOMENTE EM sales_reps NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

## 13. Comando futuro proposto

Comando proposto para fase futura (nao executar nesta 22Z-R2):

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --pilot-authorization "AUTORIZO A SEGUNDA ESCRITA PILOTO DA BASELINE 22Z-R2 SOMENTE EM sales_reps NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260626-224906.json \
  --pilot-entity sales_reps \
  --execute-pilot-write \
  --write
```

Observacao:

- o executor atual ainda esta travado para piloto em `legal_entities`, entao este comando e apenas proposta contratual para fase futura com hard stop apropriado.

## 14. Evidencias before/after futuras

Contrato de evidencia before (futuro):

- target ref e project name;
- batch;
- autorizacao geral + autorizacao piloto de `sales_reps`;
- entidade piloto declarada;
- contagem antes de `sales_reps`;
- registros planejados;
- chave idempotente usada;
- validacao de dependencias (`tenant_id`, FKs, escopo);
- confirmacao explicita de exclusao de `profiles`, `user_*`, `company_contacts`;
- confirmacao de zero transacionais/filas/integracoes externas.

Contrato de evidencia after (futuro):

- contagem depois e delta;
- registros criados/afetados;
- identificador/chave natural utilizada;
- erros (se houver);
- confirmacao de escopo unico em `sales_reps`;
- confirmacao de bloqueio de execucao ampliada.

## 15. Riscos restantes

- ausencia de constraint unica para `tenant_id + erp_vendor_code` (risco de duplicidade/sobrescrita);
- `erp_vendor_code` opcional no schema (necessita regra obrigatoria de piloto);
- incompatibilidade potencial entre formato ERP code esperado em docs antigos e tipo real (`integer`) no schema;
- input resumido (`latest.json`) nao comprova linha-a-linha se todos os 2 registros planejados possuem `erp_vendor_code` valido.

## 16. Decisao final GO/PARCIAL/NO-GO

**PARCIAL**

Justificativa:

- `sales_reps` esta presente no input e no write plan com contagem planejada confirmada (`2`);
- dependencias basicas sao aceitaveis e sem dependencia direta de `profiles`;
- porem a idempotencia ainda nao esta tecnicamente fechada por constraint unica e por regra de fallback para `erp_vendor_code` ausente;
- nenhuma escrita foi executada, executor nao foi alterado, escopo da fase foi respeitado.

## 17. Recomendacao da proxima fase

Executar fase dedicada de decisao tecnica pre-execucao para `sales_reps` (ainda sem escrita), com:

- regra formal obrigando `erp_vendor_code` para todos os registros do piloto;
- validacao read-only do payload real dos 2 registros planejados;
- definicao de estrategia segura caso algum registro venha sem `erp_vendor_code` (sem inventar chave);
- definicao de hard stop no executor para piloto `sales_reps` antes de qualquer mutacao;
- somente depois novo gate humano para eventual execucao real.

## 18. Confirmacoes obrigatorias

- nova escrita em banco: nao
- SQL de escrita executado: nao
- migration: nao
- seed/cleanup: nao
- rollback: nao
- ERP/API/webhook/n8n: nao
- filas processadas: nao
- deploy: nao
- commit: nao
- push: nao
- executor alterado: nao
- staging/prod alterados: nao
- executor executou escrita ampliada: nao
