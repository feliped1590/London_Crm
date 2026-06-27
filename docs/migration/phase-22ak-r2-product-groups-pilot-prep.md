# Fase 22AK-R2 — Preparar piloto `product_groups` com payload congelado (sem escrita)

## 1. Objetivo

Preparar tecnicamente a futura escrita piloto de `product_groups`, sem executar mutacao, congelando payload final e politicas operacionais.

## 2. Escopo

- pre-check Git;
- leitura obrigatoria dos documentos/evidencias da trilha 22AJ/22AG/22AF + scripts e artifacts base;
- extracao e congelamento do payload de `product_groups`;
- validacao read-only de schema, defaults, constraints, indices e colisao;
- definicao de politicas de `tenant_id`, `created_by` e idempotencia;
- definicao de gate humano e contrato before/after.

## 3. Restricoes absolutas

- sem insert/update/upsert/delete;
- sem SQL/RPC de escrita;
- sem migration/seed/cleanup/rollback;
- sem alteracao de schema/staging/prod;
- sem ERP/API/webhook/n8n e sem filas;
- sem alterar executor;
- sem commit/push;
- sem alterar `latest.json` e `BASELINE_SIMULATION`;
- sem preencher `created_by` com usuario real.

## 4. Estado atual

- branch: `main`;
- ultimo commit: `f5639fca feat(migration): add product types pilot baseline write`;
- divergencia: `0 0`;
- pendencias preexistentes esperadas da 22AJ-R2:
  - `docs/migration/phase-22aj-r2-next-product-aux-gate.md`
  - `artifacts/migration/phase-22aj-r2-next-product-aux-gate/`.

## 5. Motivo da escolha de `product_groups`

- entidade recomendada pela 22AJ-R2 com decisao `GO`;
- payload linha-a-linha rastreavel na simulacao da baseline;
- contagem planejada pequena (`1`);
- chave idempotente por `UNIQUE(value)`;
- sem colisao atual para valor/label candidato.

## 6. Payload final congelado

Registro congelado:

- `source`: `baseline_simulation_22g_r2`
- `temp_key`: `TMP-22F-R2-PRODGROUP-01`
- `value`: `TMP-PG-001`
- `label`: `TMP Product Group`
- `tenant_id`: `null`
- `created_by`: `null`

## 7. Origem do payload

Origem primaria:

- `scripts/migration/phase-22g-r2-baseline-dry-run.mjs`
- secao: `BASELINE_SIMULATION.product_groups[0]`

Regras de mapeamento:

- `value <- code` (direto, sem transformacao);
- `label <- name` (direto, sem transformacao).

## 8. Politica de `tenant_id`

Definicao: **Opcao A — Escopo global/null**.

Decisao:

- usar `tenant_id = null`.

Justificativa:

- payload origem nao traz tenant;
- `tenant_id` e nullable;
- `UNIQUE(value)` e global;
- sem colisao atual do candidato;
- alinhado ao comportamento aprovado para `product_types`.

## 9. Politica de `created_by`

Definicao: **nao preencher** (`created_by = null/omit`).

Justificativa:

- `created_by` e nullable;
- nao ha fonte segura de usuario no payload;
- proibido vincular auth/perfil real na fase de preparacao.

## 10. Politica dos defaults obrigatorios

Validado em schema real:

- `dimension_profile`: NOT NULL com default `'none'::dimension_profile`;
- `ficha_profile`: NOT NULL com default `'none'::text`.

Politica:

- omitir ambos no payload congelado da escrita futura;
- aceitar preenchimento automatico pelos defaults do banco;
- nao preencher manualmente nesta fase.

## 11. Schema/constraints

Resumo read-only de `public.product_groups`:

- PK: `PRIMARY KEY (id)`;
- unique: `UNIQUE(value)`;
- FKs:
  - `tenant_id -> tenants(id)`
  - `created_by -> auth.users(id)`;
- check:
  - `ficha_profile` restrito a valores permitidos;
- indice adicional:
  - `idx_product_groups_dimension_profile`.

## 12. Regra de idempotencia

Politica futura definida:

- chave principal: `value`;
- se `value` nao existir: futura fase pode inserir;
- se `value` existir e bater com payload esperado (`value`, `label`, `tenant_id`, `dimension_profile`, `ficha_profile`): `idempotent_noop`;
- se divergir: abortar com **NO-GO**;
- proibido overwrite automatico, delete e cleanup.

## 13. Validacao de colisao

Read-only no estado atual:

- total atual `product_groups`: `21`;
- `value='TMP-PG-001'`: `0`;
- `label='TMP Product Group'`: `0`;
- duplicidade global por `value`: `0`;
- duplicidade por `tenant_id + value`: `0`.

## 14. Gate humano especifico

Frase obrigatoria para fase futura:

`AUTORIZO A QUARTA ESCRITA PILOTO DA BASELINE 22AK-R2 SOMENTE EM product_groups NO RESTORE-TEST nsnmlleplpzsefzkuxlb`

Somente documentada nesta fase; nenhuma escrita executada.

## 15. Comando futuro proposto

Comando proposto (nao executar nesta fase):

```bash
node scripts/migration/phase-22k-r2-baseline-write.mjs \
  --expected-target nsnmlleplpzsefzkuxlb \
  --batch baseline_22f_r2_restore_test_qualyvac \
  --authorization "AUTORIZO A ESCRITA CONTROLADA DA BASELINE 22H-R2 NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --pilot-authorization "AUTORIZO A QUARTA ESCRITA PILOTO DA BASELINE 22AK-R2 SOMENTE EM product_groups NO RESTORE-TEST nsnmlleplpzsefzkuxlb" \
  --input artifacts/migration/phase-22g-r2-baseline-dry-run/latest.json \
  --write-plan artifacts/migration/phase-22o-r2-baseline-write-plan/write-plan-20260627-181728.json \
  --pilot-payload artifacts/migration/phase-22ak-r2-product-groups-pilot-prep/product-groups-payload-20260627-183504.json \
  --pilot-entity product_groups \
  --execute-pilot-write \
  --write
```

Observacao: o executor atual ainda nao aceita `product_groups` como entidade piloto; fase futura precisa hard stop especifico antes de qualquer execucao real.

## 16. Contrato before/after

Before futuro deve conter:

- target, project, batch;
- autorizacoes geral e piloto;
- entidade piloto `product_groups`;
- payload congelado;
- contagem antes;
- lookup por `value` e `label`;
- politicas `tenant_id` e `created_by`;
- defaults esperados (`dimension_profile`, `ficha_profile`);
- confirmacao de exclusao de outras entidades e de transacionais/filas/ERP.

After futuro deve conter:

- contagem depois e delta;
- registro criado/encontrado;
- `value`, `label`, `tenant_id`, `dimension_profile`, `ficha_profile`, `created_by`;
- operacao (`inserted`/`idempotent_noop`);
- erros (se houver);
- confirmacao de escopo unico e bloqueio de execucao ampliada.

## 17. Evidencia JSON gerada

- `artifacts/migration/phase-22ak-r2-product-groups-pilot-prep/product-groups-payload-20260627-183504.json`

## 18. Riscos restantes

- manter ordem de negocio das auxiliares para evitar drift semantico;
- na fase de execucao, validar explicitamente retorno dos defaults para `dimension_profile` e `ficha_profile` no after.

## 19. Decisao final GO/PARCIAL/NO-GO

**GO**

Motivos:

- payload final foi congelado com origem rastreavel;
- politicas de `tenant_id` e `created_by` ficaram explicitas e conservadoras;
- defaults obrigatorios confirmados;
- idempotencia por `value` definida;
- sem colisao atual;
- sem escrita e sem alteracao do executor.

## 20. Recomendacao da proxima fase

Preparar o executor para modo piloto `product_groups` com hard stop final (sem escrita real), validando `--pilot-payload` dedicado e contrato before/after antes do gate de execucao.

## 21. Confirmacoes obrigatorias

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
